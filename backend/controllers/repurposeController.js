exports.repurposePost = async (req, res) => {
  const { postId } = req.params;
  const { type, tone = "neutro" } = req.body;

  // Simulação de busca do post original
  const mockPost = {
    id: postId,
    content: "Hoje estamos com 20% OFF para os fãs da nossa padaria. Venha aproveitar!"
  };

  let newContent = "";

  switch (type) {
    case "story":
      newContent = "🎉 20% OFF só hoje! Corre aqui 🥐";
      break;
    case "video":
      newContent = "Roteiro: Mostre a vitrine cheia → Texto na tela: '20% OFF HOJE!' → Música animada 🎵";
      break;
    case "email":
      newContent = `Olá! Temos uma surpresa deliciosa pra você: 20% de desconto hoje!
Aproveite antes que acabe 😋
Abraços,
Equipe CresceJá`;
      break;
    case "alt_caption":
      newContent = "Hoje é dia de desconto! 🥖 Aproveite 20% OFF em nossos produtos. | Ou: Promoção quentinha saindo do forno! 🍞";
      break;
    default:
      return res.status(400).json({ error: "Tipo inválido de repurpose." });
  }

  return res.status(200).json({
    post_id: mockPost.id,
    type,
    tone,
    content: newContent,
    media_url: null
  });
};