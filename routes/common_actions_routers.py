# main.py
from fastapi import FastAPI, Depends, HTTPException, status, Query, APIRouter, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from service.auth import require_role, get_current_user
from service.dependencies_service import get_action_service_dep
from service.common_actions_service import CommonActionService
from service.telegram_notifier import notify_common_action_created
from database.schemas import (
    CommonActionCreate,
    CommonActionUpdate,
    CommonActionOut,
    QuestionAnswerCreate,
    QuestionAnswerUpdate,
    QuestionAnswerOut,
)

common_actions_router = APIRouter(prefix="/api/v1/common_actions", tags=["акции,общие"])



@common_actions_router.post("/", response_model=CommonActionOut, status_code=status.HTTP_201_CREATED)
async def create_action(
    data: CommonActionCreate,
    background_tasks: BackgroundTasks,
    service: CommonActionService = Depends(get_action_service_dep)
):
    try:
        action = await service.create_action(data)

        # Отправляем уведомление уже после успешного ответа
        background_tasks.add_task(notify_common_action_created, action)

        return action
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@common_actions_router.get("/", response_model=list[CommonActionOut])
async def list_actions(
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    service: CommonActionService = Depends(get_action_service_dep),
    user: dict = Depends(get_current_user)
):
    if any(role in ["admin", "superadmin", "vip"] for role in user["role"]):

        actions, _ = await service.list_actions_with_qa_all(offset=offset, limit=limit, is_vip=None)
        return actions

    else:

        actions, _ = await service.list_actions_with_qa_all(offset=offset, limit=limit, is_vip=False)
        return actions


@common_actions_router.get("/search", response_model=List[CommonActionOut])
async def search_action_by_name(
    q: str = Query(..., min_length=1, max_length=100),
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    service: CommonActionService = Depends(get_action_service_dep)
):
    actions, _ = await service.get_action_by_name(q, offset=offset, limit=limit)
    return actions


@common_actions_router.get("/{action_id}", response_model=CommonActionOut)
async def get_action(
    action_id: int,
    service: CommonActionService = Depends(get_action_service_dep)
):
    action = await service.get_action_with_qa(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


@common_actions_router.put("/{action_id}", response_model=CommonActionOut)
async def update_action(
    action_id: int,
    data: CommonActionUpdate,
    service: CommonActionService = Depends(get_action_service_dep)
):
    try:
        return await service.update_action(action_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@common_actions_router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: int,
    service: CommonActionService = Depends(get_action_service_dep)
):
    success = await service.delete_action(action_id)
    if not success:
        raise HTTPException(status_code=404, detail="Action not found")


@common_actions_router.post("/{action_id}/qa/", response_model=QuestionAnswerOut)
async def create_qa(
    action_id: int,
    data: QuestionAnswerCreate,
    service: CommonActionService = Depends(get_action_service_dep)
):
    try:
        return await service.create_question_answer(action_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@common_actions_router.patch("/qa/{qa_id}", response_model=QuestionAnswerOut)
async def update_qa(
    qa_id: int,
    data: QuestionAnswerUpdate,
    service: CommonActionService = Depends(get_action_service_dep)
):
    try:
        return await service.update_question_answer(qa_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@common_actions_router.patch("/qa/{qa_id}/approve", response_model=QuestionAnswerOut)
async def approve_qa(
    qa_id: int,
    service: CommonActionService = Depends(get_action_service_dep)
):
    try:
        return await service.approve_question_answer(qa_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@common_actions_router.delete("/qa/{qa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_qa(
    qa_id: int,
    service: CommonActionService = Depends(get_action_service_dep)
):
    success = await service.delete_question_answer(qa_id)
    if not success:
        raise HTTPException(status_code=404, detail="QA not found")


@common_actions_router.get("/qas/unapproved_qas", response_model=Optional[list[QuestionAnswerOut]])
async def get_unapproved_qas(
    service: CommonActionService = Depends(get_action_service_dep)
):
    unapproved_qas = await service.get_unapproved_qa()
    if not unapproved_qas:
        raise HTTPException(status_code=404, detail="No unapproved QAs found.")
    return unapproved_qas