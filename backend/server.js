// server.js
// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '13.38.24.191.nip.io';  // Alteração importante para AWS

// Middleware para servir arquivos estáticos (front-end)
app.use(express.static('public'));
app.use(express.json());

// Adicionar CORS para permitir requisições do frontend
app.use(cors({
  origin:  'http://localhost:5173' || 'http://13.38.24.191.nip.io',
  credentials: true
}));

// Middleware para logging de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Configuração do multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

// Variável global para armazenar o PDF atual em memória
let currentPdfDoc = null;

/**
 * Endpoint para autenticação
 */
app.post('/auth', (req, res) => {
  console.log('Recebida requisição de autenticação');
  
  const { password } = req.body;
  
  if (!password) {
    console.log('Password não fornecida');
    return res.status(400).json({ 
      success: false,
      message: 'Password não fornecida' 
    });
  }
  
  // Usa a password definida na variável de ambiente
  if (password === process.env.AUTH_PASSWORD) {
    console.log('Autenticação bem-sucedida');
    return res.json({ 
      success: true,
      message: 'Autenticação bem-sucedida'
    });
  } else {
    console.log('Password incorreta');
    return res.status(401).json({
      success: false,
      message: 'Password incorreta'
    });
  }
});

/**
 * Endpoint para inicializar/criar um PDF vazio.
 * (Opcional: pode ser usado para reiniciar o documento.)
 */
app.post('/pdf/init', async (req, res) => {
  currentPdfDoc = await PDFDocument.create();
  res.send({ message: "PDF inicializado com sucesso!" });
});

/**
 * Endpoint para reiniciar/limpar o PDF atual.
 */
app.post('/pdf/reset', async (req, res) => {
  currentPdfDoc = null;
  res.send({ message: "PDF reiniciado com sucesso!" });
});

/**
 * Endpoint para adicionar uma nova página com um título em uma posição específica.
 * O endpoint espera receber um JSON com os campos:
 *   - title: (string) o texto que será exibido na nova página;
 *   - position: (number) a posição onde a nova página deverá ser inserida (opcional);
 *   - font: (string) o nome da fonte a ser usada (opcional). Valores aceitáveis: "helvetica", "timesroman", "courier", "symbol", "zapfdingbats".
 *
 * Se currentPdfDoc não estiver inicializado, ele será criado automaticamente.
 */
app.post('/pdf/addPageTitle', async (req, res) => {
  const { title, position, font } = req.body;
  
  // Se o PDF atual não existe, cria-o automaticamente
  if (!currentPdfDoc) {
    currentPdfDoc = await PDFDocument.create();
  }
  
  // Define dimensões para a nova página (por exemplo, tamanho Carta: 612 x 792)
  const pageWidth = 612;
  const pageHeight = 792;
  
  // Determina a posição de inserção
  let insertPos = parseInt(position);
  if (isNaN(insertPos) || insertPos < 0 || insertPos > currentPdfDoc.getPageCount()) {
    insertPos = currentPdfDoc.getPageCount();
  }
  
  // Insere a nova página na posição desejada.
  const newPage = currentPdfDoc.insertPage(insertPos, [pageWidth, pageHeight]);
  
  // Seleciona a fonte com base no parâmetro recebido (default: Helvetica)
  let fontChoice = (font || 'helvetica').toLowerCase();
  let embeddedFont;
  try {
    if (fontChoice === 'timesroman') {
      embeddedFont = await currentPdfDoc.embedFont(StandardFonts.TimesRoman);
    } else if (fontChoice === 'courier') {
      embeddedFont = await currentPdfDoc.embedFont(StandardFonts.Courier);
    } else if (fontChoice === 'symbol') {
      embeddedFont = await currentPdfDoc.embedFont(StandardFonts.Symbol);
    } else if (fontChoice === 'zapfdingbats') {
      embeddedFont = await currentPdfDoc.embedFont(StandardFonts.ZapfDingbats);
    } else {
      // Padrão para Helvetica
      embeddedFont = await currentPdfDoc.embedFont(StandardFonts.Helvetica);
    }
  } catch (e) {
    console.error("Erro ao embutir a fonte, usando Helvetica como fallback.", e);
    embeddedFont = await currentPdfDoc.embedFont(StandardFonts.Helvetica);
    fontChoice = 'helvetica';
  }
  
  // Configura o tamanho do texto
  const fontSize = 24;
  const effectiveTitle = title || "Título";
  
  // Calcula a largura do texto e centraliza horizontalmente
  const textWidth = embeddedFont.widthOfTextAtSize(effectiveTitle, fontSize);
  const xPos = (pageWidth - textWidth) / 2;
  
  // Desenha o texto na nova página
  newPage.drawText(effectiveTitle, {
    x: xPos,
    y: pageHeight - 50,  // Aproximadamente 50 unidades abaixo do topo
    size: fontSize,
    font: embeddedFont,
    color: rgb(0, 0, 0),
  });
  
  res.send({ 
    message: `Página com título "${effectiveTitle}" adicionada na posição ${insertPos} utilizando a fonte "${fontChoice}".`
  });
});

/**
 * Endpoint para inserir um PDF (ou suas páginas) no documento atual.
 * Se o documento atual ainda não foi criado, ele será inicializado automaticamente.
 * Espera um upload de arquivo (campo "file") e um parâmetro "position"
 * que indica em qual posição (índice) as páginas deverão ser inseridas.
 * Se a posição não for válida, as páginas serão adicionadas no final.
 */
app.post('/pdf/insert', upload.single('file'), async (req, res) => {
  // Se currentPdfDoc não estiver inicializado, cria-o automaticamente
  if (!currentPdfDoc) {
    currentPdfDoc = await PDFDocument.create();
  }
  
  const { position } = req.body; // posição de inserção (opcional)
  const filePath = req.file.path;
  const fileData = fs.readFileSync(filePath);
  
  try {
    const pdfToInsert = await PDFDocument.load(fileData);
    // Copia todas as páginas do PDF que será inserido
    const pagesToInsert = await currentPdfDoc.copyPages(pdfToInsert, pdfToInsert.getPageIndices());
    
    // Determina a posição de inserção
    let insertPos = parseInt(position);
    if (isNaN(insertPos) || insertPos < 0 || insertPos > currentPdfDoc.getPageCount()) {
      insertPos = currentPdfDoc.getPageCount(); // adiciona no final, se posição inválida
    }
    
    // Insere cada página na posição desejada
    pagesToInsert.forEach((page, index) => {
      currentPdfDoc.insertPage(insertPos + index, page);
    });
    
    res.send({ message: `PDF inserido na posição ${insertPos}.` });
  } catch (error) {
    console.error('Erro ao inserir PDF:', error);
    res.status(500).send({ message: 'Erro ao inserir PDF.' });
  } finally {
    // Remove o arquivo temporário de upload
    fs.unlinkSync(filePath);
  }
});

/**
 * Endpoint para retornar o PDF atual (para visualização).
 */
app.get('/pdf', async (req, res) => {
  if (!currentPdfDoc) {
    return res.status(404).send('Nenhum PDF disponível.');
  }
  try {
    const pdfBytes = await currentPdfDoc.save();
    console.log('Tamanho do PDF gerado:', pdfBytes.byteLength);
    const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
    console.log('Cabeçalho do PDF:', header);
    res.contentType("application/pdf");
    // Converte o Uint8Array para Buffer antes de enviar
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).send('Erro ao gerar PDF.');
  }
});

/**
 * Endpoint para download do PDF atual.
 */
app.get('/download', async (req, res) => {
  console.log('📥 Iniciando download do PDF');
  
  if (!currentPdfDoc) {
    console.log('❌ Nenhum PDF disponível');
    return res.status(404).json({ error: 'Nenhum PDF disponível.' });
  }

  try {
    console.log('🔄 Gerando PDF...');
    const pdfBytes = await currentPdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false
    });
    
    console.log(`📊 Tamanho do PDF gerado: ${pdfBytes.length} bytes`);

    // Importante: Limpar quaisquer headers anteriores
    res.removeHeader('Content-Type');
    res.removeHeader('Content-Disposition');
    
    // Configurar headers corretos
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBytes.length,
      'Content-Disposition': 'attachment; filename="documento.pdf"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Enviar o buffer diretamente
    console.log('📤 Enviando PDF...');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ 
      error: 'Erro ao gerar PDF',
      details: error.message 
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});
