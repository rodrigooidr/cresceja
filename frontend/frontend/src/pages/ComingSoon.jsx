// src/pages/ComingSoon.jsx
export default function ComingSoon({ title = "Em breve" }) {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="text-gray-600 mt-2">
          Esta tela ainda está em desenvolvimento. Voltar para a{" "}
          <a className="text-blue-600 underline" href="/">Landing Page</a>.
        </p>
      </div>
    </div>
  );
}
