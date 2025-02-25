import React, { useEffect, useRef, useState } from 'react';

function App() {
  const pdfContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const positionInputRef = useRef(null);

  const titleInputRef = useRef(null);         // Texto do título
  const titlePositionRef = useRef(null);        // Posição para inserir a página com título
  const fontInputRef = useRef(null);           // Fonte para o título
  const passwordInputRef = useRef(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [scrollToPage, setScrollToPage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  // URL da API
  const API_URL = import.meta.env.VITE_API_URL;

  // Função para verificar a password
  const handleAuthentication = async () => {
    try {
      setIsLoading(true);
      setAuthError('');
      const password = passwordInputRef.current.value;
      
      if (!password) {
        setAuthError('Por favor, introduza a password.');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setIsAuthenticated(true);
        setRefreshTrigger(prev => prev + 1); // Carregar o PDF após autenticação
      } else {
        setAuthError(data.message || 'Password incorreta. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
      setAuthError('Erro ao tentar autenticar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para terminar a sessão
  const handleLogout = () => {
    setIsAuthenticated(false);
    if (pdfContainerRef.current) {
      pdfContainerRef.current.innerHTML = 'Autenticação necessária para visualizar o PDF.';
    }
  };

  // Função para buscar e renderizar o PDF usando PDF.js
  const refreshPdf = async () => {
    // Se não estiver autenticado, não carrega o PDF
    if (!isAuthenticated) {
      if (pdfContainerRef.current) {
        pdfContainerRef.current.innerHTML = 'Autenticação necessária para visualizar o PDF.';
      }
      return;
    }

    const pdfContainer = pdfContainerRef.current;
    pdfContainer.innerHTML = 'Carregando PDF...';
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/pdf`);
      if (!res.ok) {
        pdfContainer.innerHTML = 'Nenhum PDF disponível.';
        setIsLoading(false);
        return;
      }

      const pdfData = await res.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
      loadingTask.promise.then(
        (pdf) => {
          pdfContainer.innerHTML = '';
          console.log('Número de páginas no PDF:', pdf.numPages);

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            pdf.getPage(pageNum).then((page) => {
              const scale = 1.0;
              const viewport = page.getViewport({ scale });
              
              const pageContainer = document.createElement('div');
              pageContainer.id = `page-${pageNum}`;  // Adicionar ID para cada página
              pageContainer.style.position = 'relative';
              pageContainer.style.marginBottom = '20px';

              const canvas = document.createElement('canvas');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              canvas.style.display = 'block';
              canvas.style.position = 'relative';
              canvas.style.zIndex = '1';
              
              const context = canvas.getContext('2d');
              const renderContext = {
                canvasContext: context,
                viewport: viewport,
              };
              page.render(renderContext);

              const pageNumberElem = document.createElement('div');
              pageNumberElem.innerText = 'Página ' + pageNum;
              pageNumberElem.classList.add('page-number');

              pageContainer.appendChild(canvas);
              pageContainer.appendChild(pageNumberElem);
              pdfContainer.appendChild(pageContainer);
              
              // Verificar se devemos rolar para esta página
              if (pageNum === scrollToPage) {
                setTimeout(() => {
                  pageContainer.scrollIntoView({ block: 'start' });
                  setScrollToPage(null); // Limpa depois de rolar
                }, 300);
              }
            });
          }
          setIsLoading(false);
        },
        (err) => {
          console.error('Erro ao carregar PDF:', err);
          pdfContainer.innerHTML = 'Erro ao carregar PDF.';
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error('Erro:', err);
      pdfContainer.innerHTML = 'Erro ao carregar PDF.';
      setIsLoading(false);
    }
  };

  // Atualiza o PDF sempre que refreshTrigger mudar
  useEffect(() => {
    refreshPdf();
  }, [refreshTrigger]);

  // Handler para inserir um PDF no documento atual
  const handleUpload = async () => {
    try {
      setIsLoading(true);
      const fileInput = fileInputRef.current;
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Selecione um arquivo PDF.');
        setIsLoading(false);
        return;
      }
      const position = positionInputRef.current.value;
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('position', position);
      
      const res = await fetch(`${API_URL}/pdf/insert`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      alert(data.message);
      
      // Configura a página para a qual rolar
      if (position !== null && position !== undefined && position !== '') {
        const pos = parseInt(position, 10);
        if (!isNaN(pos)) {
          console.log(`Definindo scroll para a página ${pos + 1}`);
          setScrollToPage(pos + 1);
        }
      }
      
      fileInput.value = '';
      positionInputRef.current.value = '';
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload do PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para atualizar a visualização do PDF
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Handler para download do PDF
  const handleDownload = async () => {
    try {
      console.log('🔄 Iniciando download...');
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/download`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error(`Tipo de conteúdo inválido: ${contentType}`);
      }

      // Ler resposta como blob
      const blob = await response.blob();
      console.log('📊 Tamanho do blob:', blob.size);

      if (blob.size === 0) {
        throw new Error('PDF vazio recebido');
      }

      // Criar e clicar no link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `documento_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Limpar recursos
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (error) {
      console.error('❌ Erro no download:', error);
      alert(`Erro ao fazer download do PDF: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para adicionar uma nova página com título
  const handleAddPageTitle = async () => {
    try {
      setIsLoading(true);
      const title = titleInputRef.current.value;
      const position = titlePositionRef.current.value;
      const fontChoice = fontInputRef.current.value;
      
      if (!title) {
        alert("Por favor, insira o título da nova página.");
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/pdf/addPageTitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, position, font: fontChoice }),
      });

      const data = await res.json();
      alert(data.message);
      
      titleInputRef.current.value = '';
      titlePositionRef.current.value = '';
      
      if (position !== null && position !== undefined && position !== '') {
        const pos = parseInt(position, 10);
        if (!isNaN(pos)) {
          setScrollToPage(pos + 1);
        }
      }
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Erro ao adicionar página com título:", error);
      alert("Erro ao adicionar página com título.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handler para reiniciar o PDF
  const handleReset = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_URL}/pdf/reset`, {
        method: 'POST',
      });
      const data = await res.json();
      alert(data.message);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Erro ao reiniciar PDF:', error);
      alert('Erro ao reiniciar o PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pdf-app-container">
      <header className="app-header">
        <h1>pdfViewer</h1>
        <p>Mesclar, visualizar e editar PDFs de forma simples e elegante</p>
      </header>
      
      {!isAuthenticated ? (
        // Tela de autenticação
        <section className="auth-container">
          <h3>Autenticação Necessária</h3>
          <div className="input-group">
            <input 
              type="password" 
              ref={passwordInputRef} 
              placeholder="Introduza a password" 
              onKeyPress={(e) => e.key === 'Enter' && handleAuthentication()}
            />
            <button onClick={handleAuthentication}>Entrar</button>
          </div>
          {authError && <p className="error-message">{authError}</p>}
        </section>
      ) : (
        // Interface principal após autenticação
        <>
          <section className={`controls ${isLoading ? 'disabled' : ''}`}>
            {/* Barra de sessão com botão de logout */}
            <div className="session-bar">
              <span>Utilizador autenticado</span>
              <button 
                onClick={handleLogout} 
                className="logout-button"
              >
                Terminar Sessão
              </button>
            </div>
            
            {/* Grupo de controles para inserção de PDF */}
            <div className="control-group">
              <h3>Inserir PDF</h3>
              <div className="input-group">
                <input type="file" ref={fileInputRef} accept="application/pdf" />
                <input
                  type="number"
                  ref={positionInputRef}
                  placeholder="Posição (opcional)"
                />
                <button onClick={handleUpload} disabled={isLoading} className="inline-button">Inserir</button>
              </div>
            </div>
            
            {/* Grupo de controles para adição de título */}
            <div className="control-group">
              <h3>Adicionar Página com Título</h3>
              <div className="input-group">
                <input type="text" ref={titleInputRef} placeholder="Título da Página" />
                <input type="number" ref={titlePositionRef} placeholder="Posição (opcional)" />
                <input type="text" ref={fontInputRef} placeholder="Fonte (ex: helvetica)" />
                <button onClick={handleAddPageTitle} disabled={isLoading} className="inline-button">Adicionar</button>
              </div>
            </div>
            
            {/* Grupo de controles para operações gerais - formato mais compacto */}
            <div className="control-group compact">
              <div className="actions-bar">
                <button onClick={handleRefresh} disabled={isLoading} className="small-button">
                  Atualizar</button>
                <button onClick={handleDownload} disabled={isLoading} className="small-button">
                  Download</button>
                <button onClick={handleReset} disabled={isLoading} className="small-button">
                  Reiniciar</button>
              </div>
            </div>
          </section>
          
          <section 
            id="pdfContainer" 
            ref={pdfContainerRef}
            className={isLoading ? 'loading' : ''}
          >
            Autenticação necessária para visualizar o PDF.
          </section>
        </>
      )}
    </div>
  );
}

export default App;
