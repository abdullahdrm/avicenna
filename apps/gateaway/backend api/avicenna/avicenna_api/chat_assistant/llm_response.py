from django.db.models import Prefetch
from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_openrouter import ChatOpenRouter
import os
from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_community.chat_models import ChatOllama

from avicenna_api.models import *
from .rag.rag_services import get_rag_result


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


SYSTEM_PROMPT = """
You are a helpful assistant for skin health platform called Avicenna.
You are answering patient questions.
Answer short and precise. 

Rules for tool usage:
- Use get_manual_info for app/manual questions.
- Use all_submissions first whenever the user asks about:
  - their submissions
  - the doctor of a submission
  - a report of a submission
  - the latest or previous submission
- all_submissions is only for finding ids and basic submission metadata.
- If the user asks for doctor details, you must call doctor_info_from_doctor_id after all_submissions to get the final answer.
- If the user asks for report details, you must first identify the correct submission id, then call the report tool.
- Do not stop after all_submissions if the question asks for detailed doctor/report information.
- If no tool is related, answer: "I can't answer that question."
- Only answer based on tool results.
- Never give ID information inside answer, only use ID's to call other tools.
""".strip()


def build_graph_for_user(user):
    @tool
    def get_manuel_info(message: str) -> str:
        """
        Get information from the Avicenna manual.
        Avicenna manual consists of two categories: app usage and skin health information.
        Use this tool when the user asks questions about:
        - how to use the app features (e.g. "How can I view my reports?", "How do I submit a new case?")
        - general skin health information (e.g. "What are common treatments for acne?", "How can I prevent dry skin?")
        If the question is not related to these categories, do not use this tool and answer "I can't answer that question."
        """
        print("get_manual_info tool called with query:", message)
        return get_rag_result(message)

    from typing import Optional

    @tool
    def all_submissions() -> str:
        """
        List the current patient's submissions.
        Use this first when the user asks generally about their submissions,
        or when you need submission ids / doctor ids for follow-up tools.
        """
        print("all_submissions tool called")

        submissions = (
            Submission.objects.filter(patient=user)
            .select_related("doctor", "report", "skin_analysis")
            .order_by("-created_at")
        )

        if not submissions.exists():
            return "You have no submissions."

        result = []
        for sub in submissions:
            report_status = "Yes" if hasattr(sub, "report") else "No"
            skin_analysis_status = "Yes" if sub.skin_analysis else "No"

            info = [
                f"Submission ID: {sub.id}",
                f"Doctor ID: {sub.doctor.id}",
                f"Doctor Username: {sub.doctor.username}",
                f"Status: {sub.status}",
                f"Has Report: {report_status}",
                f"Has Skin Analysis: {skin_analysis_status}",
                f"Created at: {sub.created_at.strftime('%Y-%m-%d %H:%M')}",
            ]
            result.append("\n".join(info))

        return "\n\n---\n\n".join(result)

    @tool
    def latest_submission_summary() -> str:
        """
        Get a concise summary of the patient's latest submission,
        including doctor, status, report availability, and analysis result if present.
        Do not give ID information in the answer, only use it to call other tools if needed.
        Useful for questions like:
        - What happened with my latest submission?
        - What is my newest submission status?
        """
        print("latest_submission_summary tool called")

        sub = (
            Submission.objects.filter(patient=user)
            .select_related("doctor", "report", "skin_analysis")
            .order_by("-created_at")
            .first()
        )

        if not sub:
            return "You have no submissions."

        lines = [
            f"Latest Submission ID: {sub.id}",
            f"Doctor ID: {sub.doctor.id}",
            f"Doctor Username: {sub.doctor.username}",
            f"Status: {sub.status}",
            f"Created at: {sub.created_at.strftime('%Y-%m-%d %H:%M')}",
        ]

        if sub.skin_analysis:
            lines.extend([
                f"Skin Analysis Status: {sub.skin_analysis.status}",
                f"Body Part: {sub.skin_analysis.body_part}",
                f"Prediction: {sub.skin_analysis.prediction or 'Not available'}",
                f"Confidence: {sub.skin_analysis.confidence}",
                f"Pain Level: {sub.skin_analysis.pain_level}",
                f"Duration: {sub.skin_analysis.duration or 'Not provided'}",
            ])

        if hasattr(sub, "report"):
            lines.extend([
                "Report: Available",
                f"Diagnosis: {sub.report.diagnosis}",
                f"Hospital Visit Needed: {'Yes' if sub.report.hospital_visit else 'No'}",
                f"Doctor Comment: {sub.report.comment or 'No comment'}",
                f"Next Submission Date: {sub.report.next_submission_date or 'Not specified'}",
            ])
        else:
            lines.append("Report: Not available yet")

        return "\n".join(lines)

    @tool
    def submission_details(submission_id: int) -> str:
        """
        Get full details for one submission belonging to the current patient.
        Includes doctor, report, medications, and skin analysis when available.
        Use this when the user asks about a specific submission id.
        """
        print("submission_details tool called with submission_id:", submission_id)

        try:
            sub = (
                Submission.objects.filter(patient=user)
                .select_related("doctor", "report", "skin_analysis")
                .prefetch_related("report__medications")
                .get(id=submission_id)
            )
        except Submission.DoesNotExist:
            return f"No submission found with id {submission_id} for the current user."

        lines = [
            f"Submission ID: {sub.id}",
            f"Status: {sub.status}",
            f"Created at: {sub.created_at.strftime('%Y-%m-%d %H:%M')}",
            f"Updated at: {sub.updated_at.strftime('%Y-%m-%d %H:%M')}",
            f"Doctor ID: {sub.doctor.id}",
            f"Doctor Username: {sub.doctor.username}",
            f"Doctor Email: {sub.doctor.email}",
        ]

        if sub.skin_analysis:
            sa = sub.skin_analysis
            lines.extend([
                "",
                "[Skin Analysis]",
                f"Analysis ID: {sa.id}",
                f"Status: {sa.status}",
                f"Body Part: {sa.body_part}",
                f"Prediction: {sa.prediction or 'Not available'}",
                f"Confidence: {sa.confidence}",
                f"Pain Level: {sa.pain_level}",
                f"Duration: {sa.duration or 'Not provided'}",
                f"Comments: {sa.comments or 'None'}",
                f"Created at: {sa.created_at.strftime('%Y-%m-%d %H:%M')}",
            ])

        if hasattr(sub, "report"):
            report = sub.report
            lines.extend([
                "",
                "[Report]",
                f"Diagnosis: {report.diagnosis}",
                f"Hospital Visit Needed: {'Yes' if report.hospital_visit else 'No'}",
                f"Comment: {report.comment or 'No comment'}",
                f"Next Submission Date: {report.next_submission_date or 'Not specified'}",
                f"Created at: {report.created_at.strftime('%Y-%m-%d %H:%M')}",
            ])

            meds = report.medications.all()
            if meds.exists():
                lines.append("")
                lines.append("[Medications]")
                for med in meds:
                    lines.append(f"- {med.name}: {med.frequency}")
            else:
                lines.append("")
                lines.append("[Medications]")
                lines.append("No medications prescribed.")
        else:
            lines.extend(["", "[Report]", "No report available yet."])

        return "\n".join(lines)

    @tool
    def doctor_info_from_doctor_id(doctor_id: int) -> str:
        """
        Get doctor information by doctor user id.
        Before calling this tool, you may call all_submissions tool to get doctor ids.
        """
        print("doctor_info_from_doctor_id tool called with doctor_id:", doctor_id)

        try:
            doctor_profile = DoctorProfile.objects.select_related("doctor").get(
                doctor_id=doctor_id
            )
        except DoctorProfile.DoesNotExist:
            return f"No doctor found with id {doctor_id}."

        doctor = doctor_profile.doctor

        info = [
            f"Doctor ID: {doctor.id}",
            f"Email: {doctor.email}",
            f"Username: {doctor.username}",
            f"Role: {doctor.role}",
            f"Experience Years: {doctor_profile.experience_years}",
            f"City: {doctor_profile.city}",
            f"Hospital: {doctor_profile.hospital}",
            f"Allowed Days: {', '.join(doctor_profile.allowed_days) if doctor_profile.allowed_days else 'None'}",
            f"Max Submissions Per Day: {doctor_profile.max_submissions_per_day}",
        ]

        return "\n".join(info)

    @tool
    def latest_report() -> str:
        """
        Get the latest available report for the current patient.
        Useful for questions like:
        - What did my doctor say?
        - What is my latest diagnosis?
        - Do I need a hospital visit?
        """
        print("latest_report tool called")

        report = (
            Report.objects.filter(submission__patient=user)
            .select_related("submission", "submission__doctor")
            .prefetch_related("medications")
            .order_by("-created_at")
            .first()
        )

        if not report:
            return "You do not have any reports yet."

        lines = [
            f"Report for Submission ID: {report.submission.id}",
            f"Doctor ID: {report.submission.doctor.id}",
            f"Doctor Username: {report.submission.doctor.username}",
            f"Diagnosis: {report.diagnosis}",
            f"Hospital Visit Needed: {'Yes' if report.hospital_visit else 'No'}",
            f"Comment: {report.comment or 'No comment'}",
            f"Next Submission Date: {report.next_submission_date or 'Not specified'}",
            f"Created at: {report.created_at.strftime('%Y-%m-%d %H:%M')}",
        ]

        meds = report.medications.all()
        if meds.exists():
            lines.append("Medications:")
            for med in meds:
                lines.append(f"- {med.name}: {med.frequency}")
        else:
            lines.append("Medications: None prescribed")

        return "\n".join(lines)

    @tool
    def medications_for_submission(submission_id: int) -> str:
        """
        Get medications prescribed for a specific submission belonging to the current patient.
        """
        print("medications_for_submission tool called with submission_id:", submission_id)

        try:
            sub = (
                Submission.objects.filter(patient=user)
                .select_related("report")
                .prefetch_related("report__medications")
                .get(id=submission_id)
            )
        except Submission.DoesNotExist:
            return f"No submission found with id {submission_id} for the current user."

        if not hasattr(sub, "report"):
            return f"No report found yet for submission {submission_id}."

        meds = sub.report.medications.all()
        if not meds.exists():
            return f"No medications were prescribed for submission {submission_id}."

        lines = [f"Medications for Submission ID: {submission_id}"]
        for med in meds:
            lines.append(f"- {med.name}: {med.frequency}")
        return "\n".join(lines)

    @tool
    def latest_skin_analysis() -> str:
        """
        Get the latest skin analysis for the current patient.
        Useful for questions about the newest scan or AI analysis.
        """
        print("latest_skin_analysis tool called")

        analysis = (
            SkinAnalysis.objects.filter(patient=user)
            .select_related("medical_case")
            .order_by("-created_at")
            .first()
        )

        if not analysis:
            return "You do not have any skin analyses yet."

        lines = [
            f"Skin Analysis ID: {analysis.id}",
            f"Status: {analysis.status}",
            f"Body Part: {analysis.body_part}",
            f"Prediction: {analysis.prediction or 'Not available'}",
            f"Confidence: {analysis.confidence}",
            f"Pain Level: {analysis.pain_level}",
            f"Duration: {analysis.duration or 'Not provided'}",
            f"Comments: {analysis.comments or 'None'}",
            f"Medical Case: {analysis.medical_case.title if analysis.medical_case else 'None'}",
            f"Created at: {analysis.created_at.strftime('%Y-%m-%d %H:%M')}",
        ]
        return "\n".join(lines)

    @tool
    def skin_analysis_by_submission(submission_id: int) -> str:
        """
        Get the skin analysis attached to a submission belonging to the current patient.
        """
        print("skin_analysis_by_submission tool called with submission_id:", submission_id)

        try:
            sub = (
                Submission.objects.filter(patient=user)
                .select_related("skin_analysis")
                .get(id=submission_id)
            )
        except Submission.DoesNotExist:
            return f"No submission found with id {submission_id} for the current user."

        if not sub.skin_analysis:
            return f"No skin analysis is attached to submission {submission_id}."

        analysis = sub.skin_analysis
        lines = [
            f"Submission ID: {submission_id}",
            f"Skin Analysis ID: {analysis.id}",
            f"Status: {analysis.status}",
            f"Body Part: {analysis.body_part}",
            f"Prediction: {analysis.prediction or 'Not available'}",
            f"Confidence: {analysis.confidence}",
            f"Pain Level: {analysis.pain_level}",
            f"Duration: {analysis.duration or 'Not provided'}",
            f"Comments: {analysis.comments or 'None'}",
            f"Created at: {analysis.created_at.strftime('%Y-%m-%d %H:%M')}",
        ]
        return "\n".join(lines)

    @tool
    def my_notifications(limit: int = 10) -> str:
        """
        Get recent notifications for the current user.
        Useful for questions like:
        - Do I have any updates?
        - What notifications do I have?
        """
        print("my_notifications tool called with limit:", limit)

        limit = max(1, min(limit, 50))

        notifications = (
            Notification.objects.filter(user=user)
            .select_related("submission")
            .order_by("-created_at")[:limit]
        )

        if not notifications:
            return "You have no notifications."

        lines = []
        for n in notifications:
            submission_text = f"Submission ID: {n.submission.id}" if n.submission else "Submission ID: None"
            lines.append(
                "\n".join([
                    f"Notification ID: {n.id}",
                    f"Message: {n.message}",
                    f"Read: {'Yes' if n.is_read else 'No'}",
                    submission_text,
                    f"Created at: {n.created_at.strftime('%Y-%m-%d %H:%M')}",
                ])
            )

        return "\n\n---\n\n".join(lines)

    @tool
    def my_medical_cases() -> str:
        """
        List the patient's medical cases.
        Useful for questions like:
        - What medical cases do I have?
        - Show my case history
        """
        print("my_medical_cases tool called")

        cases = (
            MedicalCase.objects.filter(patient=user)
            .prefetch_related("timeline_images")
            .order_by("-created_at")
        )

        if not cases.exists():
            return "You have no medical cases."

        result = []
        for case in cases:
            result.append(
                "\n".join([
                    f"Medical Case ID: {case.id}",
                    f"Title: {case.title}",
                    f"Disease Type: {case.disease_type or 'Not specified'}",
                    f"Is Active: {'Yes' if case.is_active else 'No'}",
                    f"Timeline Image Count: {case.timeline_images.count()}",
                    f"Created at: {case.created_at.strftime('%Y-%m-%d %H:%M')}",
                ])
            )

        return "\n\n---\n\n".join(result)

    @tool
    def medical_case_details(case_id: int) -> str:
        """
        Get details of one medical case belonging to the current patient,
        including its timeline skin analyses.
        """
        print("medical_case_details tool called with case_id:", case_id)

        try:
            case = (
                MedicalCase.objects.filter(patient=user)
                .prefetch_related("timeline_images")
                .get(id=case_id)
            )
        except MedicalCase.DoesNotExist:
            return f"No medical case found with id {case_id} for the current user."

        lines = [
            f"Medical Case ID: {case.id}",
            f"Title: {case.title}",
            f"Disease Type: {case.disease_type or 'Not specified'}",
            f"Is Active: {'Yes' if case.is_active else 'No'}",
            f"Created at: {case.created_at.strftime('%Y-%m-%d %H:%M')}",
            "",
            "[Timeline Images / Analyses]",
        ]

        analyses = case.timeline_images.all().order_by("-created_at")
        if analyses.exists():
            for a in analyses:
                lines.extend([
                    f"- Analysis ID: {a.id}",
                    f"  Date: {a.created_at.strftime('%Y-%m-%d %H:%M')}",
                    f"  Body Part: {a.body_part}",
                    f"  Prediction: {a.prediction or 'Not available'}",
                    f"  Confidence: {a.confidence}",
                    f"  Status: {a.status}",
                ])
        else:
            lines.append("No timeline analyses found.")

        return "\n".join(lines)

    tools = [get_manuel_info, all_submissions, doctor_info_from_doctor_id,
             latest_submission_summary, submission_details, latest_report,
             medications_for_submission, latest_skin_analysis,
             skin_analysis_by_submission, my_notifications,
             my_medical_cases, medical_case_details]

    API_KEY = ""

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
        google_api_key=API_KEY,
    )

    llm_with_tools = llm.bind_tools(tools)

    def assistant_node(state: AgentState) -> AgentState:
        response = llm_with_tools.invoke(
            [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
        )
        return {"messages": [response]}

    tool_node = ToolNode(tools)

    graph_builder = StateGraph(AgentState)
    graph_builder.add_node("assistant", assistant_node)
    graph_builder.add_node("tools", tool_node)

    graph_builder.add_edge(START, "assistant")
    graph_builder.add_conditional_edges(
        "assistant",
        tools_condition,
        {
            "tools": "tools",
            "__end__": END,
        },
    )
    graph_builder.add_edge("tools", "assistant")

    return graph_builder.compile()
