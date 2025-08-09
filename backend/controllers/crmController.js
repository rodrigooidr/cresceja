exports.autoCreateLead = (req, res) => {
    const { name, phone, email, source } = req.body;

    // Aqui você integraria com o banco de dados real
    console.log("Lead salvo:", { name, phone, email, source });

    return res.status(201).json({ message: 'Lead salvo com sucesso.' });
};