# Backend additions expected by the web panel

Add these endpoints to Django:

- `GET /api/doctor/dashboard/`
  - returns:
    ```json
    {
      "total_cases": 10,
      "pending_cases": 4,
      "reviewed_cases": 6,
      "cases": [...]
    }
    ```

- `GET /api/doctor/cases/`
  - returns:
    ```json
    {
      "cases": [...]
    }
    ```

- `GET /api/doctor/case/<photo_id>/`
  - returns one serialized case object

- `POST /api/doctor/review/<photo_id>/`
  - accepts:
    ```json
    {
      "diagnosis": "eczema",
      "confidence": 0.82,
      "doctor_note": "Likely eczema"
    }
    ```
  - returns:
    ```json
    {
      "status": "updated",
      "photo": { ... }
    }
    ```

## Suggested Django views

Use the doctor-only views you drafted earlier:
- `DoctorDashboardView`
- `DoctorCaseListView`
- `DoctorCaseDetailView`
- `DoctorReviewCaseView`

and secure them with:
- `IsAuthenticated`
- `IsDoctor`
