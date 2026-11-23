// Временный экран-заглушка: проверка, что сборка, публикация и установка работают.
// Долина, костёр и доска заданий появятся на следующих шагах.
export function App() {
  return (
    <main class="placeholder">
      <img class="placeholder__icon" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
      <h1>Просвет</h1>
      <p>Долина ещё спит под хмарью. Скоро здесь станет светлее.</p>
    </main>
  );
}
