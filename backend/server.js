// server.js
const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware para servir arquivos estáticos (front-end)
app.use(express.static('public'));
app.use(express.json());

// Configuração do multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

// Variável global para armazenar o PDF atual em memória
let currentPdfDoc = null;

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
  currentPdfDoc = await PDFDocument.create();
  res.send({ message: "PDF reiniciado com sucesso!" });
});

/**
 * Endpoint para adicionar uma nova página com um título em uma posição específica.
 * O endpoint espera receber um JSON com os campos:
 *   - title: (string) o texto que será exibido na nova página;
 *   - position: (number) a posição onde a nova página deverá ser inserida (opcional).
 *
 * Se currentPdfDoc não estiver inicializado, ele será criado automaticamente.
 */
app.post('/pdf/addPageTitle', async (req, res) => {
  // Obtém o título e a posição do corpo da requisição
  const { title, position } = req.body;
  
  // Se o PDF atual não existe, cria-o automaticamente
  if (!currentPdfDoc) {
    currentPdfDoc = await PDFDocument.create();
  }
  
  // Define dimensões para a nova página (por exemplo, tamanho Carta: 612 x 792)
  const pageWidth = 612;
  const pageHeight = 792;
  
  // Determina a posição de inserção:
  // Se position for um número válido, converte para inteiro; caso contrário, insere no final.
  let insertPos = parseInt(position);
  if (isNaN(insertPos) || insertPos < 0 || insertPos > currentPdfDoc.getPageCount()) {
    insertPos = currentPdfDoc.getPageCount();
  }
  
  // Insere a nova página na posição desejada.
  // A função insertPage permite especificar as dimensões da página.
  const newPage = currentPdfDoc.insertPage(insertPos, [pageWidth, pageHeight]);
  
  // Define o texto do título. Você pode ajustar a posição, o tamanho e a cor conforme necessário.
  // Neste exemplo, o título é desenhado a 50 unidades do lado esquerdo e 750 do rodapé.
  newPage.drawText(title || 'Título', {
    x: 50,
    y: pageHeight - 50,  // Aproximadamente 50 unidades abaixo do topo
    size: 24,
    color: rgb(0, 0, 0),
  });
  
  res.send({ message: `Página com título "${title}" adicionada na posição ${insertPos}.` });
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
  if (!currentPdfDoc) {
    return res.status(404).send('Nenhum PDF disponível.');
  }
  try {
    const pdfBytes = await currentPdfDoc.save();
    console.log('Tamanho do PDF:', pdfBytes.byteLength);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="output.pdf"'
    });
    // Converte o Uint8Array para Buffer antes de enviar
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).send('Erro ao gerar PDF.');
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
