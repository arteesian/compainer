from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from database.common_actions_repo import CommonActionRepository
from database.models import CommonAction
from database.schemas import (
    CommonActionCreate,
    CommonActionUpdate,
    QuestionAnswerCreate,
    QuestionAnswerUpdate,
)



class CommonActionService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = CommonActionRepository(session)

    async def create_action(self, data: CommonActionCreate) -> CommonAction:
        try:
            action = await self.repo.create_action(**data.model_dump())
            await self.session.commit()

            stmt = select(CommonAction).where(CommonAction.id == action.id).options(
                selectinload(CommonAction.questions_answers))
            result = await self.session.execute(stmt)
            action = result.scalar_one()
            return action
        except Exception:
            await self.session.rollback()
            raise


    async def get_action_with_qa(self, action_id: int):
        return await self.repo.get_action_with_qa(action_id)


    async def list_actions_with_qa_all(
        self, offset: int = 0, limit: int = 20, is_vip: bool = None
    ) -> Tuple[List, int]:
        return await self.repo.list_actions_with_qa_all(offset=offset, limit=limit, is_vip=is_vip)


    async def update_action(self, action_id: int, data: CommonActionUpdate):
        try:
            await self.repo.update_action(action_id, **data.model_dump(exclude_unset=True))
            await self.session.commit()
            action = await self.repo.get_action_with_qa(action_id)
            return action
        except Exception:
            await self.session.rollback()
            raise


    async def delete_action(self, action_id: int) -> bool:
        try:
            success = await self.repo.delete_action(action_id)
            if success:
                await self.session.commit()
            else:
                await self.session.rollback()
            return success
        except Exception:
            await self.session.rollback()
            raise


    async def create_question_answer(self, action_id: int, data: QuestionAnswerCreate):
        try:
            qa = await self.repo.create_question_answer(action_id=action_id, **data.model_dump())
            await self.session.commit()
            await self.session.refresh(qa, attribute_names=["action"])
            return qa
        except Exception:
            await self.session.rollback()
            raise


    async def update_question_answer(self, qa_id: int, data: QuestionAnswerUpdate):
        try:
            await self.repo.update_question_answer(qa_id, **data.model_dump(exclude_unset=True))
            await self.session.commit()
            qa = await self.repo.get_question_answer(qa_id)
            return qa
        except Exception:
            await self.session.rollback()
            raise


    async def approve_question_answer(self, qa_id: int):
        try:
            qa = await self.repo.approve_question_answer(qa_id)
            await self.session.commit()
            await self.session.refresh(qa)
            return qa
        except Exception:
            await self.session.rollback()
            raise


    async def delete_question_answer(self, qa_id: int) -> bool:
        try:
            success = await self.repo.delete_question_answer(qa_id)
            if success:
                await self.session.commit()
            else:
                await self.session.rollback()
            return success
        except Exception:
            await self.session.rollback()
            raise


    async def get_unapproved_qa(self):
        return await self.repo.get_all_unapproved()
    
    async def get_action_by_name(self, query: str, offset: int, limit: int):
        return await self.repo.search_actions_by_name(query, offset, limit)