from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.support import Dispute, DisputeStatus, Issue, IssueStatus, Report, ReportStatus, ReportedType
from app.api.v1.endpoints.activity import log_activity
from app.models.activity_log import ActivityType, EntityType

router = APIRouter()


# ============== Request/Response Models ==============

class DisputeCreateRequest(BaseModel):
    watch_reference: str
    watch_brand: Optional[str] = None
    watch_model: Optional[str] = None
    description: str


class DisputeUpdateRequest(BaseModel):
    status: Optional[DisputeStatus] = None
    admin_notes: Optional[str] = None


class DisputeResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    watch_reference: str
    watch_brand: Optional[str]
    watch_model: Optional[str]
    description: str
    status: DisputeStatus
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class IssueCreateRequest(BaseModel):
    title: str
    description: str


class IssueUpdateRequest(BaseModel):
    status: Optional[IssueStatus] = None
    admin_notes: Optional[str] = None


class IssueResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    title: str
    description: str
    status: IssueStatus
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class ReportCreateRequest(BaseModel):
    reported_type: str  # conversation, group, user
    reported_id: str
    reported_name: str
    reason: str
    description: Optional[str] = None


class ReportUpdateRequest(BaseModel):
    status: Optional[ReportStatus] = None
    admin_notes: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    reporter_id: str
    reporter_name: str
    reporter_email: str
    reported_type: str
    reported_id: str
    reported_name: str
    reason: str
    description: Optional[str]
    status: ReportStatus
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


# ============== User Endpoints ==============

@router.get("/disputes", response_model=List[DisputeResponse])
async def get_my_disputes(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user's disputes"""
    disputes = await Dispute.find(
        Dispute.user_id == str(current_user.id)
    ).sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(d.id),
            "user_id": d.user_id,
            "user_name": d.user_name,
            "user_email": d.user_email,
            "watch_reference": d.watch_reference,
            "watch_brand": d.watch_brand,
            "watch_model": d.watch_model,
            "description": d.description,
            "status": d.status,
            "admin_notes": d.admin_notes,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
        }
        for d in disputes
    ]


@router.post("/disputes", response_model=DisputeResponse)
async def create_dispute(
    data: DisputeCreateRequest,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None, alias="X-Platform"),
) -> Any:
    """Create a new dispute"""
    dispute = Dispute(
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        watch_reference=data.watch_reference,
        watch_brand=data.watch_brand,
        watch_model=data.watch_model,
        description=data.description,
        status=DisputeStatus.OPEN,
        created_at=datetime.utcnow(),
    )
    await dispute.insert()

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.DISPUTE_CREATED,
        description=f"{current_user.name} created a dispute for {data.watch_brand or ''} {data.watch_model or ''} ({data.watch_reference})",
        user=current_user,
        entity_type=EntityType.DISPUTE,
        entity_id=str(dispute.id),
        metadata={
            "watch_reference": data.watch_reference,
            "watch_brand": data.watch_brand,
            "watch_model": data.watch_model,
            "platform": platform,
        },
        platform=platform,
    )

    return {
        "id": str(dispute.id),
        "user_id": dispute.user_id,
        "user_name": dispute.user_name,
        "user_email": dispute.user_email,
        "watch_reference": dispute.watch_reference,
        "watch_brand": dispute.watch_brand,
        "watch_model": dispute.watch_model,
        "description": dispute.description,
        "status": dispute.status,
        "admin_notes": dispute.admin_notes,
        "created_at": dispute.created_at,
        "updated_at": dispute.updated_at,
    }


@router.get("/issues", response_model=List[IssueResponse])
async def get_my_issues(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user's issues"""
    issues = await Issue.find(
        Issue.user_id == str(current_user.id)
    ).sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(i.id),
            "user_id": i.user_id,
            "user_name": i.user_name,
            "user_email": i.user_email,
            "title": i.title,
            "description": i.description,
            "status": i.status,
            "admin_notes": i.admin_notes,
            "created_at": i.created_at,
            "updated_at": i.updated_at,
        }
        for i in issues
    ]


@router.post("/issues", response_model=IssueResponse)
async def create_issue(
    data: IssueCreateRequest,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None, alias="X-Platform"),
) -> Any:
    """Create a new issue report"""
    issue = Issue(
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        title=data.title,
        description=data.description,
        status=IssueStatus.OPEN,
        created_at=datetime.utcnow(),
    )
    await issue.insert()

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.ISSUE_CREATED,
        description=f"{current_user.name} reported an issue: {data.title}",
        user=current_user,
        entity_type=EntityType.ISSUE,
        entity_id=str(issue.id),
        metadata={
            "title": data.title,
            "platform": platform,
        },
        platform=platform,
    )

    return {
        "id": str(issue.id),
        "user_id": issue.user_id,
        "user_name": issue.user_name,
        "user_email": issue.user_email,
        "title": issue.title,
        "description": issue.description,
        "status": issue.status,
        "admin_notes": issue.admin_notes,
        "created_at": issue.created_at,
        "updated_at": issue.updated_at,
    }


@router.post("/reports", response_model=ReportResponse)
async def create_report(
    data: ReportCreateRequest,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None, alias="X-Platform"),
) -> Any:
    """Create a new report for a conversation, group, or user"""
    # Validate reported_type
    try:
        reported_type = ReportedType(data.reported_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reported_type. Must be one of: {[e.value for e in ReportedType]}"
        )

    report = Report(
        reporter_id=str(current_user.id),
        reporter_name=current_user.name,
        reporter_email=current_user.email,
        reported_type=reported_type,
        reported_id=data.reported_id,
        reported_name=data.reported_name,
        reason=data.reason,
        description=data.description,
        status=ReportStatus.OPEN,
        created_at=datetime.utcnow(),
    )
    await report.insert()

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.REPORT_CREATED,
        description=f"{current_user.name} reported a {data.reported_type}: {data.reported_name}",
        user=current_user,
        entity_type=EntityType.REPORT,
        entity_id=str(report.id),
        metadata={
            "reported_type": data.reported_type,
            "reported_id": data.reported_id,
            "reason": data.reason,
            "platform": platform,
        },
        platform=platform,
    )

    return {
        "id": str(report.id),
        "reporter_id": report.reporter_id,
        "reporter_name": report.reporter_name,
        "reporter_email": report.reporter_email,
        "reported_type": report.reported_type.value,
        "reported_id": report.reported_id,
        "reported_name": report.reported_name,
        "reason": report.reason,
        "description": report.description,
        "status": report.status,
        "admin_notes": report.admin_notes,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


# ============== Admin Endpoints ==============

@router.get("/admin/disputes", response_model=List[DisputeResponse])
async def get_all_disputes(
    status: Optional[DisputeStatus] = None,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Get all disputes (admin only)"""
    query_conditions = []
    if status:
        query_conditions.append(Dispute.status == status)

    if query_conditions:
        disputes = await Dispute.find(*query_conditions).sort([("created_at", -1)]).to_list()
    else:
        disputes = await Dispute.find().sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(d.id),
            "user_id": d.user_id,
            "user_name": d.user_name,
            "user_email": d.user_email,
            "watch_reference": d.watch_reference,
            "watch_brand": d.watch_brand,
            "watch_model": d.watch_model,
            "description": d.description,
            "status": d.status,
            "admin_notes": d.admin_notes,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
        }
        for d in disputes
    ]


@router.patch("/admin/disputes/{dispute_id}", response_model=DisputeResponse)
async def update_dispute(
    dispute_id: str,
    data: DisputeUpdateRequest,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Update a dispute (admin only)"""
    dispute = await Dispute.get(PydanticObjectId(dispute_id))
    if not dispute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dispute not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await dispute.set(update_data)

    return {
        "id": str(dispute.id),
        "user_id": dispute.user_id,
        "user_name": dispute.user_name,
        "user_email": dispute.user_email,
        "watch_reference": dispute.watch_reference,
        "watch_brand": dispute.watch_brand,
        "watch_model": dispute.watch_model,
        "description": dispute.description,
        "status": dispute.status,
        "admin_notes": dispute.admin_notes,
        "created_at": dispute.created_at,
        "updated_at": dispute.updated_at,
    }


@router.get("/admin/issues", response_model=List[IssueResponse])
async def get_all_issues(
    status: Optional[IssueStatus] = None,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Get all issues (admin only)"""
    query_conditions = []
    if status:
        query_conditions.append(Issue.status == status)

    if query_conditions:
        issues = await Issue.find(*query_conditions).sort([("created_at", -1)]).to_list()
    else:
        issues = await Issue.find().sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(i.id),
            "user_id": i.user_id,
            "user_name": i.user_name,
            "user_email": i.user_email,
            "title": i.title,
            "description": i.description,
            "status": i.status,
            "admin_notes": i.admin_notes,
            "created_at": i.created_at,
            "updated_at": i.updated_at,
        }
        for i in issues
    ]


@router.patch("/admin/issues/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: str,
    data: IssueUpdateRequest,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Update an issue (admin only)"""
    issue = await Issue.get(PydanticObjectId(issue_id))
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await issue.set(update_data)

    return {
        "id": str(issue.id),
        "user_id": issue.user_id,
        "user_name": issue.user_name,
        "user_email": issue.user_email,
        "title": issue.title,
        "description": issue.description,
        "status": issue.status,
        "admin_notes": issue.admin_notes,
        "created_at": issue.created_at,
        "updated_at": issue.updated_at,
    }


@router.get("/admin/reports", response_model=List[ReportResponse])
async def get_all_reports(
    report_status: Optional[ReportStatus] = None,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Get all reports (admin only)"""
    query_conditions = []
    if report_status:
        query_conditions.append(Report.status == report_status)

    if query_conditions:
        reports = await Report.find(*query_conditions).sort([("created_at", -1)]).to_list()
    else:
        reports = await Report.find().sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(r.id),
            "reporter_id": r.reporter_id,
            "reporter_name": r.reporter_name,
            "reporter_email": r.reporter_email,
            "reported_type": r.reported_type.value,
            "reported_id": r.reported_id,
            "reported_name": r.reported_name,
            "reason": r.reason,
            "description": r.description,
            "status": r.status,
            "admin_notes": r.admin_notes,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in reports
    ]


@router.patch("/admin/reports/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    data: ReportUpdateRequest,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Update a report (admin only)"""
    report = await Report.get(PydanticObjectId(report_id))
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await report.set(update_data)

    return {
        "id": str(report.id),
        "reporter_id": report.reporter_id,
        "reporter_name": report.reporter_name,
        "reporter_email": report.reporter_email,
        "reported_type": report.reported_type.value,
        "reported_id": report.reported_id,
        "reported_name": report.reported_name,
        "reason": report.reason,
        "description": report.description,
        "status": report.status,
        "admin_notes": report.admin_notes,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }
