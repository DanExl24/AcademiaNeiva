"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
router.post("/login", authController_1.login);
router.get("/check-document/:document", userController_1.checkDocument);
exports.default = router;
