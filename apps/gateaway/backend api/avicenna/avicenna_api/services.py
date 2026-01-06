from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import (
    FollowUpCase, FollowUpRequest, FollowUpLink, FollowUpNote, Notification, AuditLog
)
from .models import Submission, DoctorProfile


def _weekday_code(date_obj) -> str:
    mapping = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    return mapping[date_obj.weekday()]


def doctor_allows_date(doctor_user, date_obj) -> (bool, str):
    try:
        prof = doctor_user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return False, "Doctor profile not found."

    wd = _weekday_code(date_obj)
    if prof.allowed_days and wd not in prof.allowed_days:
        return False, f"Doctor is not available on {_weekday_code(date_obj)}."

    start = timezone.make_aware(timezone.datetime.combine(
        date_obj, timezone.datetime.min.time()))
    end = timezone.make_aware(timezone.datetime.combine(
        date_obj, timezone.datetime.max.time()))
    total = Submission.objects.filter(
        doctor=doctor_user, created_at__range=(start, end)).count()

    if total >= prof.max_submissions_per_day:
        return False, "Doctor has reached max submissions for that day."

    return True, "OK"


@transaction.atomic
def notify(user, notif_type, title, body="", payload=None):
    payload = payload or {}
    Notification.objects.create(
        user=user,
        notif_type=notif_type,
        title=title,
        body=body,
        payload=payload,
    )


def audit(actor, action, entity, entity_id="", meta=None):
    AuditLog.objects.create(
        actor=actor,
        action=action,
        entity=entity,
        entity_id=str(entity_id or ""),
        meta=meta or {},
    )


@transaction.atomic
def create_followup_link(case: FollowUpCase, submission: Submission, actor):
    next_seq = (FollowUpLink.objects.filter(
        case=case).aggregate(mx=Count("id"))["mx"] or 0) + 1
    link = FollowUpLink.objects.create(
        case=case, submission=submission, sequence_number=next_seq)

    case.last_followup_at = timezone.now()
    case.save(update_fields=["last_followup_at", "updated_at"])

    audit(actor, "followup_submitted", "FollowUpLink", link.id,
          {"case_id": case.id, "submission_id": submission.id})

    notify(
        user=case.doctor,
        notif_type="followup_submitted",
        title="New follow-up submission received",
        body=f"Patient submitted a follow-up for case #{case.id}.",
        payload={"case_id": case.id, "submission_id": submission.id},
    )

    return link


@transaction.atomic
def approve_request(req: FollowUpRequest, actor, approved_date, doctor_response=""):
    ok, msg = doctor_allows_date(req.doctor, approved_date)
    if not ok:
        raise ValidationError(msg)

    req.status = FollowUpRequest.STATUS_APPROVED
    req.approved_date = approved_date
    req.doctor_response = doctor_response
    req.save(update_fields=["status", "approved_date",
             "doctor_response", "updated_at"])

    case = req.case
    case.scheduled_date = approved_date
    case.save(update_fields=["scheduled_date", "updated_at"])

    audit(actor, "followup_request_approved", "FollowUpRequest",
          req.id, {"approved_date": str(approved_date)})

    notify(
        user=req.patient,
        notif_type="followup_approved",
        title="Follow-up approved",
        body=f"Doctor approved your follow-up for {approved_date}.",
        payload={"case_id": case.id, "request_id": req.id,
                 "scheduled_date": str(approved_date)},
    )


@transaction.atomic
def decline_request(req: FollowUpRequest, actor, doctor_response=""):
    req.status = FollowUpRequest.STATUS_DECLINED
    req.doctor_response = doctor_response
    req.save(update_fields=["status", "doctor_response", "updated_at"])

    audit(actor, "followup_request_declined", "FollowUpRequest", req.id, {})

    notify(
        user=req.patient,
        notif_type="followup_declined",
        title="Follow-up declined",
        body=doctor_response or "Doctor declined your follow-up request.",
        payload={"case_id": req.case.id, "request_id": req.id},
    )
