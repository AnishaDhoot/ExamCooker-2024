"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  Clock,
  ArrowLeft,
  Trophy,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface QuizContent {
  title: string;
  weeks: Week[];
}

interface Week {
  name: string;
  questions: Question[];
}

interface Question {
  question: string;
  options: string[];
  answer: string[];
}

interface QuizQuestion extends Omit<Question, 'answer'> {
  answer: string; 
  selectedAnswer?: string;
  isMarked?: boolean;
  weekNumber: string;
  isExpanded?: boolean;
}

const QuizComponent: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false);
  const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null);
  const [showError, setShowError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuizContent = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const url = new URL(window.location.href);
        const pathParts = pathname.split("/quiz/");
        if (pathParts.length < 2) {
          throw new Error("Invalid quiz URL format.");
        }
        const courseCodeWithParams = pathParts[1];
        const [courseCode] = courseCodeWithParams.split("?");

        const params = new URLSearchParams(url.search);
        const weeksParam = params.get("weeks");
        const numQuestionsParam = params.get("numQ");
        const timeParam = params.get("time");

        if (!courseCode) {
          throw new Error("Course code not found in URL.");
        }

        const weeks = weeksParam ? weeksParam.split("-").map(Number) : [];
        const numQuestions = numQuestionsParam ? parseInt(numQuestionsParam) : 0;
        const timeSeconds = timeParam
          ? parseInt(timeParam.substring(0, 2)) * 3600 +
            parseInt(timeParam.substring(2, 4)) * 60 +
            parseInt(timeParam.substring(4, 6))
          : 0;

        setTimeRemaining(timeSeconds > 0 ? timeSeconds : 30 * 60); 

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/courses/${courseCode}`
        );
        if (!response.ok) {
          throw new Error(`Error fetching quiz content: ${response.statusText}`);
        }

        const data: QuizContent = await response.json();

        const allQuestions: QuizQuestion[] = data.weeks
          .filter((week) => weeks.includes(parseInt(week.name)))
          .flatMap((week) =>
            week.questions.map((q) => ({
              question: q.question,
              options: q.options,
              answer: q.answer[0], 
              weekNumber: week.name,
              isExpanded: false,
            }))
          );

        if (allQuestions.length === 0) {
          throw new Error("No questions available for the selected weeks.");
        }

        const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
        setQuestions(shuffledQuestions.slice(0, numQuestions));
      } catch (error: any) {
        setFetchError(error.message || "An unknown error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizContent();
  }, [pathname]);

  useEffect(() => {
    if (timeRemaining === 0 && !quizSubmitted && questions.length > 0) {
      submitQuiz();
    }
  }, [timeRemaining, quizSubmitted, questions]);

  useEffect(() => {
    if (timeRemaining > 0 && !quizSubmitted) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            submitQuiz();
            clearInterval(timer);
            return 0;
          }

          if (prev === 30) {
            setShowWarning(true);
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, quizSubmitted]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  const handleAnswerSelect = (answer: string) => {
    setShowError(false);
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex].selectedAnswer = answer;
    setQuestions(updatedQuestions);
  };

  const submitQuiz = () => {
    const correctAnswers = questions.filter(
      (q) => q.selectedAnswer === q.answer
    ).length;
    setScore(correctAnswers);
    setQuizSubmitted(true);
  };

  const goToNextQuestion = () => {
    const currentQuestion = questions[currentQuestionIndex];

    if (!currentQuestion.selectedAnswer) {
      setShowError(true);
      return;
    }

    setShowError(false);
    if (currentQuestionIndex === questions.length - 1) {
      submitQuiz();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const toggleQuestionExpansion = (index: number) => {
    if (quizSubmitted) {
      setExpandedQuestionIndex(expandedQuestionIndex === index ? null : index);
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-800 dark:bg-green-800/20";
    if (percentage >= 60) return "text-yellow-600 dark:bg-yellow-800/20";
    return "dark:bg-red-800/20 text-red-800";
  };

  let content;

  if (isLoading) {
    content = (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-16 w-16 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  } else if (fetchError) {
    content = (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">{fetchError}</p>
      </div>
    );
  } else if (questions.length === 0) {
    content = (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-700 dark:text-gray-300">No questions available.</p>
      </div>
    );
  } else if (quizSubmitted) {
    const displayedQuestions = showOnlyIncorrect
      ? questions.filter((q) => q.selectedAnswer !== q.answer)
      : questions;

    const percentage = ((score / questions.length) * 100).toFixed(1);

    content = (
      <div className="lg:w-[75vw] md:w-[90vw] mx-auto px-4 py-8">
        <div className="mb-8 bg-[#5FC4E7] dark:bg-[#ffffff]/20 shadow-lg overflow-hidden dark:border-2">
          <div className="text-center p-6">
            <div className="flex justify-center mb-4">
              <Trophy className="w-16 h-16 dark:text-[#D5D5D5]" />
            </div>
            <h1 className="text-2xl font-bold dark:text-[#D5D5D5]">
              Quiz Complete!
            </h1>
            <p className="text-lg mt-2 text-black dark:text-[#D5D5D5] font-semibold">
              Here's how you performed
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center p-2">
              <div
                className={`text-4xl font-bold flex flex-col justify-center items-center p-4 ${getScoreColor(
                  Number(percentage)
                )}`}
              >
                <p className="text-md uppercase font-medium mb-1">Score</p>
                <p className="text-3xl">
                  {score}/{questions.length}
                </p>
              </div>
              <div
                className={`text-4xl font-bold flex flex-col justify-center items-center p-4 ${getScoreColor(
                  Number(percentage)
                )}`}
              >
                <p className="text-md uppercase font-medium mb-1">
                  Percentage
                </p>
                <p className={`text-3xl font-bold`}>{percentage}%</p>
              </div>
              <div
                className={`text-4xl font-bold flex flex-col justify-center items-center p-4 ${getScoreColor(
                  Number(percentage)
                )}`}
              >
                <p className="text-md uppercase font-medium mb-1">Questions</p>
                <p className="text-3xl">
                  {questions.filter((q) => q.selectedAnswer === q.answer).length} correct
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2 bg-[#5FC4E7] dark:bg-[#ffffff]/20 p-3">
            <Target size={20} />
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyIncorrect}
                onChange={(e) => setShowOnlyIncorrect(e.target.checked)}
                className="form-checkbox h-5 w-5"
              />
              <span className="text-base font-medium dark:text-[#D5D5D5]">
                Show Incorrect Only
              </span>
            </label>
          </div>
          <span className="text-md text-dark font-medium dark:text-[#D5D5D5] p-4 justify-end">
            Showing {displayedQuestions.length} of {questions.length} questions
          </span>
        </div>

        <div className="w-full grid sm:grid-cols-4 grid-cols-3 gap-4 mb-6">
          {displayedQuestions.map((q, index) => (
            <div
              key={index}
              className={`p-2 py-4 cursor-pointer transition-all duration-300 ${
                expandedQuestionIndex === index ? "col-span-4" : ""
              } ${
                q.selectedAnswer === q.answer
                  ? "bg-green-200 dark:bg-[#1a271a] text-[#037d00]"
                  : "bg-red-200 dark:bg-[#341a1a] font-semibold text-[#cb0909]"
              }`}
              onClick={() => toggleQuestionExpansion(index)}
            >
              <div className="flex justify-between items-center">
                <p className="text-md text-black dark:text-[#D5D5D5]">
                  Question {index + 1}
                </p>
                {expandedQuestionIndex === index ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </div>
              {expandedQuestionIndex === index && (
                <div className="mt-2">
                  <p className="text-black dark:text-[#D5D5D5]">
                    {q.question}
                  </p>
                  <p className="mt-2">
                    Your answer:{" "}
                    <span
                      className={
                        q.selectedAnswer === q.answer
                          ? "text-green-800 font-semibold"
                          : "text-red-800 font-semibold"
                      }
                    >
                      {q.selectedAnswer || "Not answered"}
                    </span>
                  </p>
                  <p className="mt-1 text-green-800 font-semibold">
                    Correct answer: {q.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between font-semibold">
          <button
            onClick={() => router.push("/quiz")}
            className="flex items-center px-6 py-3 bg-[#5FC4E7] dark:bg-[#008A90] hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={20} className="mr-2" />
            Try Another Quiz
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center px-6 py-3 bg-[#5FC4E7] dark:bg-[#008A90] hover:opacity-90 transition-opacity"
          >
            Return Home
            <ChevronRight size={20} className="ml-2" />
          </button>
        </div>
      </div>
    );

  } else {
    const currentQuestion = questions[currentQuestionIndex];

    content = (
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="flex items-center space-x-2">
            <Clock
              className={`${
                timeRemaining <= 30
                  ? "text-red-500 animate-pulse"
                  : "text-black dark:text-white"
              }`}
            />
            <span
              className={`font-mono text-lg sm:text-xl ${
                timeRemaining <= 30
                  ? "text-red-500"
                  : "text-black dark:text-white"
              }`}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="text-lg sm:text-md text-black dark:text-white">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
        </div>

        {showWarning && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-lg mb-4 text-sm sm:text-base">
            30 seconds remaining! Please finish your quiz.
          </div>
        )}

        <div className="flex flex-col items-center justify-center">
          <div className="flex mb-4 bg-[#5FC4E7] dark:bg-[#008A90] text-black dark:text-[#D5D5D5] min-h-[10vh] w-[70vw] shadow-md">
            <h2 className="text-base sm:text-xl font-medium flex justify-center items-center p-3 sm:p-4 text-center shadow-sm">
              {currentQuestionIndex + 1}. {currentQuestion.question}
            </h2>
          </div>

          <div className="space-y-3 w-[60vw]">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className={`p-3 sm:p-4 text-left dark:border dark:border-[#D5D5D5] transition-colors w-full text-sm sm:text-base text-black dark:text-[#D5D5D5] ${
                  currentQuestion.selectedAnswer === option
                    ? "bg-[#82BEE9] dark:bg-white/20 text-white shadow-lg"
                    : "bg-[#5FC4E7] dark:bg-[#0C1222]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {showError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm w-[60vw] text-center">
              Please select an answer before proceeding
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4 mt-4 sm:mt-6">
          <button
            onClick={goToNextQuestion}
            className="dark:text-[#D5D5D5] px-4 sm:px-6 py-2 text-lg font-semibold bg-[#5FC4E7] dark:bg-[#008A90] hover:opacity-90 transition-opacity"
          >
            {currentQuestionIndex === questions.length - 1 ? "Submit" : "Next"}
            <ChevronRight size={20} className="ml-2 inline" />
          </button>
        </div>
      </div>
    );
  }

  return content;
};

export default QuizComponent;