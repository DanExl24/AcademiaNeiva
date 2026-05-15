"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gradoService_1 = require("../services/gradoService");
const router = (0, express_1.Router)();
router.get("/available/:idColegio", async (req, res) => {
    try {
        const { idColegio } = req.params;
        const grados = await gradoService_1.GradoService.getAvailable(Number(idColegio));
        res.json(grados);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
