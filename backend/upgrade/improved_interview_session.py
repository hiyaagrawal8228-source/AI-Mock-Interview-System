# backend/improved_interview_session.py
"""
Production-grade interview session with:
- No question repetition
- Proper duration-based question count
- Difficulty control
- Complete evaluation pipeline
"""

from typing import List, Dict, Optional
from backend.question_generator import QuestionGenerator, calculate_question_count
from backend.evaluation_engine import EvaluationEngine

class ImprovedInterviewSession:
    """Enhanced interview session with production-grade features"""
    
    def __init__(
        self,
        skills: List[str],
        role: str = "",
        duration_minutes: int = 10,
        difficulty: str = "easy",
        session_id: str = "default"
    ):
        """
        Initialize interview session
        
        Args:
            skills: Candidate skills from resume
            role: Job role
            duration_minutes: Interview duration in minutes
            difficulty: Question difficulty (easy/medium/hard)
            session_id: Unique session identifier
        """
        self.skills = skills if skills else ["general"]
        self.role = role
        self.duration_minutes = duration_minutes
        self.difficulty = difficulty.lower()
        self.session_id = session_id
        
        # Calculate appropriate question count
        self.max_questions = calculate_question_count(duration_minutes)
        
        # Initialize question generator
        self.question_generator = QuestionGenerator(
            skills=self.skills,
            difficulty=self.difficulty,
            max_questions=self.max_questions
        )
        
        # Initialize evaluation engine
        self.evaluator = EvaluationEngine()
        
        # Session state
        self.current_question_index = 0
        self.history: List[Dict[str, str]] = []
        self.confidence_scores: List[float] = []
        self.focus_scores: List[float] = []
        
        # Generate first question
        self.current_question = self._get_first_question()
        
    def _get_first_question(self) -> str:
        """Get the first interview question"""
        if self.role:
            return f"Tell me about your experience with {self.skills[0] if self.skills else 'technology'} and why you're interested in the {self.role} position."
        else:
            return f"Can you describe your experience with {self.skills[0] if self.skills else 'your primary skill'}?"
    
    def ask_question(self) -> Optional[str]:
        """
        Get the next question
        
        Returns:
            Next question string or None if interview complete
        """
        # First question
        if self.current_question_index == 0:
            self.current_question_index += 1
            self.history.append({
                "question": self.current_question,
                "answer": None
            })
            return self.current_question
        
        # Check if interview is complete
        if self.current_question_index >= self.max_questions:
            return None
        
        # Check if we have unanswered questions
        if self.history and self.history[-1]["answer"] is None:
            return self.history[-1]["question"]
        
        # Get next unique question
        next_question = self.question_generator.get_next_question()
        
        if next_question:
            self.history.append({
                "question": next_question,
                "answer": None
            })
            self.current_question_index += 1
            self.current_question = next_question
            return next_question
        
        return None
    
    def provide_answer(self, answer: str, confidence: float = 0.0, focus: float = 0.0):
        """
        Record candidate's answer
        
        Args:
            answer: Answer text
            confidence: Audio-based confidence score (0-100)
            focus: Focus/attention score (0-1)
        """
        if self.history and self.history[-1]["answer"] is None:
            self.history[-1]["answer"] = answer
            
            # Store metrics
            if confidence > 0:
                self.confidence_scores.append(confidence)
            if focus > 0:
                self.focus_scores.append(focus * 100)  # Convert to 0-100 scale
    
    def is_complete(self) -> bool:
        """Check if interview is complete"""
        return self.current_question_index >= self.max_questions
    
    def get_progress(self) -> Dict:
        """Get interview progress"""
        answered = sum(1 for qa in self.history if qa.get("answer"))
        return {
            "total_questions": self.max_questions,
            "current_question": self.current_question_index,
            "answered": answered,
            "progress_percentage": (answered / self.max_questions * 100) if self.max_questions > 0 else 0
        }
    
    def generate_report(self) -> Dict:
        """
        Generate comprehensive interview report
        
        Returns:
            Complete evaluation report with scores, grade, and feedback
        """
        # Get evaluation from engine
        evaluation = self.evaluator.evaluate_interview(
            questions_and_answers=self.history,
            confidence_scores=self.confidence_scores,
            skills=self.skills
        )
        
        # Add session metadata
        report = {
            "session_id": self.session_id,
            "role": self.role,
            "duration_minutes": self.duration_minutes,
            "difficulty": self.difficulty,
            "skills_assessed": self.skills,
            "questions_asked": [qa["question"] for qa in self.history],
            "answers_provided": [qa.get("answer", "") for qa in self.history],
            
            # Scores
            "confidence_score": evaluation["confidence_score"],
            "technical_score": evaluation["technical_score"],
            "communication_score": evaluation["communication_score"],
            "overall_score": evaluation["overall_score"],
            
            # Grading
            "grade": evaluation["grade"],
            "skill_level": evaluation["skill_level"],
            
            # Analysis
            "questions_evaluated": evaluation["questions_evaluated"],
            "strengths": evaluation["strengths"],
            "weaknesses": evaluation["weaknesses"],
            "recommendations": evaluation["recommendations"],
            
            # Detailed breakdown
            "detailed_evaluations": evaluation["detailed_evaluations"],
            
            # Interview summary
            "interview_summary": self._generate_summary(evaluation)
        }
        
        return report
    
    def _generate_summary(self, evaluation: Dict) -> str:
        """Generate human-readable interview summary"""
        grade = evaluation["grade"]
        skill_level = evaluation["skill_level"]
        overall = evaluation["overall_score"]
        
        summary_parts = [
            f"The candidate demonstrated {skill_level.lower()} proficiency with an overall score of {overall}/100 ({grade}).",
        ]
        
        if evaluation["strengths"]:
            summary_parts.append(
                f"Key strengths include: {', '.join(evaluation['strengths'][:2])}."
            )
        
        if evaluation["weaknesses"]:
            summary_parts.append(
                f"Areas for improvement: {', '.join(evaluation['weaknesses'][:2])}."
            )
        
        return " ".join(summary_parts)
    
    def get_transcript(self) -> str:
        """Get formatted interview transcript"""
        transcript_lines = []
        for i, qa in enumerate(self.history, 1):
            transcript_lines.append(f"Q{i}: {qa['question']}")
            transcript_lines.append(f"A{i}: {qa.get('answer', '(no answer)')}")
            transcript_lines.append("")
        return "\n".join(transcript_lines)


class HRInterviewSession(ImprovedInterviewSession):
    """HR/Behavioral interview session"""
    
    HR_QUESTIONS = {
        "easy": [
            "Tell me about yourself.",
            "Why do you want to work here?",
            "What are your greatest strengths?",
            "Where do you see yourself in 5 years?",
            "Why should we hire you?"
        ],
        "medium": [
            "Describe a challenging situation you faced and how you handled it.",
            "Tell me about a time you worked in a team.",
            "How do you handle stress and pressure?",
            "Describe a time you failed and what you learned.",
            "How do you prioritize your work?"
        ],
        "hard": [
            "Tell me about a time you had to convince someone to see things your way.",
            "Describe a situation where you had to make a difficult decision.",
            "How do you handle conflicts with team members?",
            "Tell me about a time you took initiative on a project.",
            "Describe your leadership style with examples."
        ]
    }
    
    def __init__(
        self,
        role: str = "",
        duration_minutes: int = 10,
        difficulty: str = "easy",
        session_id: str = "default"
    ):
        # Initialize with behavioral questions
        super().__init__(
            skills=["communication", "teamwork", "problem-solving"],
            role=role,
            duration_minutes=duration_minutes,
            difficulty=difficulty,
            session_id=session_id
        )
        
        # Override with HR-specific questions
        self._setup_hr_questions()
    
    def _setup_hr_questions(self):
        """Setup HR-specific question pool"""
        import random
        questions = self.HR_QUESTIONS.get(self.difficulty, self.HR_QUESTIONS["easy"])
        self.hr_question_pool = questions.copy()
        random.shuffle(self.hr_question_pool)
        self.hr_index = 0
    
    def _get_first_question(self) -> str:
        """Get first HR question"""
        return "Tell me about yourself and your background."
    
    def ask_question(self) -> Optional[str]:
        """Get next HR question"""
        # First question
        if self.current_question_index == 0:
            self.current_question_index += 1
            self.history.append({
                "question": self.current_question,
                "answer": None
            })
            return self.current_question
        
        # Check completion
        if self.current_question_index >= self.max_questions:
            return None
        
        # Check unanswered
        if self.history and self.history[-1]["answer"] is None:
            return self.history[-1]["question"]
        
        # Get next HR question
        if self.hr_index < len(self.hr_question_pool):
            next_q = self.hr_question_pool[self.hr_index]
            self.hr_index += 1
        else:
            # Fallback to generic question
            next_q = f"Tell me more about your experience with {self.role or 'this field'}."
        
        self.history.append({
            "question": next_q,
            "answer": None
        })
        self.current_question_index += 1
        self.current_question = next_q
        return next_q
