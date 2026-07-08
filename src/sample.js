export const blankQuestion = () => ({
  prompt: 'Новый вопрос',
  imageUrl: '',
  type: 'single',
  options: [
    { label: 'Вариант A', isCorrect: true },
    { label: 'Вариант B', isCorrect: false },
    { label: 'Вариант C', isCorrect: false },
    { label: 'Вариант D', isCorrect: false },
  ],
});

export const quickQuiz = {
  title: 'Новый квиз',
  description: 'Короткое описание для участников перед стартом.',
  category: 'Общее',
  timeLimit: 30,
  pointsPerQuestion: 100,
};
