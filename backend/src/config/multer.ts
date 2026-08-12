import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB (alineado con Nginx client_max_body_size)
});

