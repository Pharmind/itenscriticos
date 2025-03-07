let estoqueChart;
let currentFilteredItems = [];

async function atualizarDashboard(filtroCategoria = 'todos', filtroStatus = 'todos', dataInicio = null, dataFim = null) {
    const itens = await getItems();
    const tbody = document.getElementById('dashboardBody');
    tbody.innerHTML = '';

    const itensFiltrados = itens.filter(item => {
        // Filtro de categoria
        const passouCategoria = 
            filtroCategoria === 'todos' ||
            filtroCategoria === item.categoria ||
            (filtroCategoria.startsWith('medicamentos-') && 
             item.categoria === 'medicamentos' && 
             item.subcategoria === filtroCategoria.split('-')[1]);
        
        if (!passouCategoria) return false;
        
        // Filtro de status
        if (filtroStatus !== 'todos') {
            // Calculate days passed since item creation
            const diasPassados = item.timestamp ? Math.floor((new Date() - new Date(item.timestamp.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0;
            // Calculate consumed items
            const diasConsumidos = diasPassados * item.consumoDiario;
            // Calculate current stock
            const estoqueAtual = Math.max(0, item.estoque - diasConsumidos);
            // Calculate days of availability with current stock
            const diasDisponiveis = Math.floor(estoqueAtual / item.consumoDiario);
            
            if (filtroStatus === 'critico' && diasDisponiveis > 15) return false;
            if (filtroStatus === 'alerta' && (diasDisponiveis <= 15 || diasDisponiveis > 30)) return false;
            if (filtroStatus === 'normal' && diasDisponiveis <= 30) return false;
        }
        
        // Filtro de data
        if (dataInicio && dataFim) {
            const itemDate = item.timestamp ? new Date(item.timestamp.seconds * 1000) : new Date();
            const inicio = new Date(dataInicio);
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59); // Set to end of day
            
            if (itemDate < inicio || itemDate > fim) return false;
        }
        
        return true;
    });

    // Ordenar itens por nome em ordem alfabética
    itensFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));

    // Atualizar tabela
    itensFiltrados.forEach(item => {
        const consumoMensal = item.consumoDiario * 30;
        
        // Calculate days passed since item creation
        const diasPassados = item.timestamp ? Math.floor((new Date() - new Date(item.timestamp.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0;
        // Calculate consumed items
        const diasConsumidos = diasPassados * item.consumoDiario;
        // Calculate current stock
        const estoqueAtual = Math.max(0, item.estoque - diasConsumidos);
        // Calculate days of availability with current stock
        const diasDisponiveis = Math.floor(estoqueAtual / item.consumoDiario);
        
        let statusClass = '';
        if (diasDisponiveis <= 15) {
            statusClass = 'status-critico';
        } else if (diasDisponiveis <= 30) {
            statusClass = 'status-alerta';
        } else {
            statusClass = 'status-ok';
        }

        const tr = document.createElement('tr');
        tr.className = statusClass;
        tr.innerHTML = `
            <td>${item.codigo}</td>
            <td>${getCategoriaText(item.categoria, item.subcategoria)}</td>
            <td>${item.nome}</td>
            <td>${item.consumoDiario}</td>
            <td>${consumoMensal}</td>
            <td>${estoqueAtual.toFixed(1)}</td>
            <td>${diasDisponiveis}</td>
            <td>${getStatusText(diasDisponiveis)}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-btn me-1" data-id="${item.id}">Editar</button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update the filtered items for PDF generation
    currentFilteredItems = itensFiltrados;

    // Adicionar event listeners para os botões de editar e excluir
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemId = this.getAttribute('data-id');
            window.location.href = `cadastro.html?edit=${itemId}`;
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const itemId = this.getAttribute('data-id');
            if (confirm('Tem certeza que deseja excluir este item?')) {
                // Get item data before deletion for history
                const oldItem = await getItemById(itemId);
                
                const success = await deleteItem(itemId);
                if (success) {
                    // Save delete history
                    await saveUpdateHistory(itemId, oldItem, null, "delete");
                    alert('Item excluído com sucesso!');
                    atualizarDashboard(filtroCategoria, filtroStatus, dataInicio, dataFim);
                } else {
                    alert('Erro ao excluir item. Tente novamente.');
                }
            }
        });
    });

    // Atualizar gráfico
    atualizarGrafico(itensFiltrados);
}

function atualizarGrafico(itens) {
    const ctx = document.getElementById('estoqueChart').getContext('2d');
    
    if (estoqueChart) {
        estoqueChart.destroy();
    }

    // On mobile, limit the items displayed to improve readability
    let displayedItems = itens;
    if (window.innerWidth < 768 && itens.length > 10) {
        displayedItems = itens.slice(0, 10);
    }

    // Get current theme to adjust chart colors
    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#f8f9fa' : '#333';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    const dados = {
        labels: displayedItems.map(item => {
            // Shorter labels on mobile
            if (window.innerWidth < 768) {
                return item.nome.length > 15 ? item.nome.substring(0, 15) + '...' : item.nome;
            }
            return `${item.codigo} - ${item.nome}`;
        }),
        datasets: [
            {
                label: 'Dias de Estoque',
                type: 'bar',
                data: displayedItems.map(item => {
                    // Calculate days passed since item creation
                    const diasPassados = item.timestamp ? Math.floor((new Date() - new Date(item.timestamp.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0;
                    // Calculate consumed items
                    const diasConsumidos = diasPassados * item.consumoDiario;
                    // Calculate current stock
                    const estoqueAtual = Math.max(0, item.estoque - diasConsumidos);
                    // Calculate days of availability with current stock
                    const diasDisponiveis = Math.floor(estoqueAtual / item.consumoDiario);
                    return diasDisponiveis;
                }),
                backgroundColor: displayedItems.map(item => {
                    // Calculate days passed since item creation
                    const diasPassados = item.timestamp ? Math.floor((new Date() - new Date(item.timestamp.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0;
                    // Calculate consumed items
                    const diasConsumidos = diasPassados * item.consumoDiario;
                    // Calculate current stock
                    const estoqueAtual = Math.max(0, item.estoque - diasConsumidos);
                    // Calculate days of availability with current stock
                    const diasDisponiveis = Math.floor(estoqueAtual / item.consumoDiario);
                    
                    if (diasDisponiveis <= 15) return 'rgba(255, 99, 132, 0.5)';
                    if (diasDisponiveis <= 30) return 'rgba(255, 205, 86, 0.5)';
                    return 'rgba(75, 192, 192, 0.5)';
                }),
                borderColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
                borderRadius: 6
            },
            {
                label: 'Consumo Diário',
                type: 'line',
                data: displayedItems.map(item => item.consumoDiario),
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                yAxisID: 'y1'
            },
            {
                label: 'Nível Crítico (15 dias)',
                type: 'line',
                data: displayedItems.map(item => item.consumoDiario * 15),
                borderColor: 'rgb(255, 0, 0)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                yAxisID: 'y1'
            }
        ]
    };

    estoqueChart = new Chart(ctx, {
        type: 'bar',
        data: dados,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Análise de Estoque por Item',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: textColor
                },
                legend: {
                    position: window.innerWidth < 768 ? 'top' : 'bottom',
                    labels: {
                        boxWidth: window.innerWidth < 768 ? 10 : 40,
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        },
                        color: textColor
                    }
                },
                tooltip: {
                    backgroundColor: isDarkMode ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    titleColor: isDarkMode ? '#f8f9fa' : '#000',
                    bodyColor: isDarkMode ? '#f8f9fa' : '#000',
                    borderColor: isDarkMode ? '#555' : '#ddd',
                    borderWidth: 1,
                    padding: 10,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Dias de Estoque',
                        color: textColor,
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        drawBorder: false,
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Quantidade',
                        color: textColor,
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor
                    }
                }
            }
        }
    });
}

async function gerarRelatorioPDF() {
    try {
        // Initialize jsPDF with custom options
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Get items
        const itens = currentFilteredItems;
        
        // Initial page with summary
        let startY = await getHeaderForPDF(doc, "Relatório de Análise de Estoque", 20);
        
        // Add summary text
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Análise Geral do Estoque", 14, startY + 10);
        
        // Calculate summary statistics
        let itemsCriticos = 0;
        let itemsAlerta = 0;
        let itemsNormais = 0;
        let totalEstoque = 0;
        let totalValor = 0;

        itens.forEach(item => {
            const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
            if (diasDisponiveis <= 15) itemsCriticos++;
            else if (diasDisponiveis <= 30) itemsAlerta++;
            else itemsNormais++;
        });

        // Add summary data
        startY += 20;
        const summaryLines = [
            `Total de Itens Analisados: ${itens.length}`,
            `Itens em Estado Crítico: ${itemsCriticos} (${Math.round((itemsCriticos/itens.length)*100)}%)`,
            `Itens em Alerta: ${itemsAlerta} (${Math.round((itemsAlerta/itens.length)*100)}%)`,
            `Itens em Situação Normal: ${itemsNormais} (${Math.round((itemsNormais/itens.length)*100)}%)`
        ];

        summaryLines.forEach((line, index) => {
            doc.text(line, 14, startY + (index * 7));
        });

        // Add new page for detailed analysis
        doc.addPage();
        startY = await getHeaderForPDF(doc, "Análise Detalhada do Estoque", 20);

        // Create table headers and data
        const headers = [
            { header: 'Código', dataKey: 'codigo' },
            { header: 'Nome', dataKey: 'nome' },
            { header: 'Estoque', dataKey: 'estoque' },
            { header: 'Dias Disponíveis', dataKey: 'dias' },
            { header: 'Status', dataKey: 'status' }
        ];

        const data = itens.map(item => {
            const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
            return {
                codigo: item.codigo,
                nome: item.nome,
                estoque: item.estoque.toString(),
                dias: diasDisponiveis.toString(),
                status: getStatusText(diasDisponiveis)
            };
        });

        // Add table
        doc.autoTable({
            startY: startY + 10,
            head: [headers.map(h => h.header)],
            body: data.map(row => headers.map(h => row[h.dataKey])),
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            headStyles: {
                fillColor: [13, 110, 253],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 60 },
                2: { cellWidth: 25 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30 }
            }
        });

        // Add sugestão de compra page
        doc.addPage();
        startY = await getHeaderForPDF(doc, "Sugestão de Compra (Estoque para 45 dias)", 20);

        const compraHeaders = [
            { header: 'Código', dataKey: 'codigo' },
            { header: 'Nome', dataKey: 'nome' },
            { header: 'Estoque Atual', dataKey: 'estoqueAtual' },
            { header: 'Consumo Diário', dataKey: 'consumoDiario' },
            { header: 'Qtd. Sugerida', dataKey: 'qtdSugerida' }
        ];

        const compraData = itens
            .filter(item => Math.floor(item.estoque / item.consumoDiario) < 45)
            .map(item => {
                const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
                const qtdNecessaria = Math.ceil((45 - diasDisponiveis) * item.consumoDiario);
                return {
                    codigo: item.codigo,
                    nome: item.nome,
                    estoqueAtual: item.estoque.toString(),
                    consumoDiario: item.consumoDiario.toString(),
                    qtdSugerida: qtdNecessaria.toString()
                };
            });

        // Add compra table
        doc.autoTable({
            startY: startY + 10,
            head: [compraHeaders.map(h => h.header)],
            body: compraData.map(row => compraHeaders.map(h => row[h.dataKey])),
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            headStyles: {
                fillColor: [13, 110, 253],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 60 },
                2: { cellWidth: 25 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30 }
            }
        });

        // Save the PDF
        doc.save('relatorio-estoque.pdf');

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Erro ao gerar relatório. Por favor, tente novamente.");
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            // User is not signed in, redirect to login page
            window.location.href = 'login.html';
            return;
        }
        
        // Load dashboard with default filters (all items)
        atualizarDashboard();
        
        // Add event listeners for filters
        document.getElementById('filtroCategoria').addEventListener('change', function() {
            const categoria = this.value;
            const status = document.getElementById('filtroStatus').value;
            const dataInicio = document.getElementById('dataInicio').value;
            const dataFim = document.getElementById('dataFim').value;
            atualizarDashboard(categoria, status, dataInicio, dataFim);
        });
        
        document.getElementById('filtroStatus').addEventListener('change', function() {
            const categoria = document.getElementById('filtroCategoria').value;
            const status = this.value;
            const dataInicio = document.getElementById('dataInicio').value;
            const dataFim = document.getElementById('dataFim').value;
            atualizarDashboard(categoria, status, dataInicio, dataFim);
        });
        
        document.getElementById('dataInicio').addEventListener('change', function() {
            const categoria = document.getElementById('filtroCategoria').value;
            const status = document.getElementById('filtroStatus').value;
            const dataInicio = this.value;
            const dataFim = document.getElementById('dataFim').value;
            atualizarDashboard(categoria, status, dataInicio, dataFim);
        });
        
        document.getElementById('dataFim').addEventListener('change', function() {
            const categoria = document.getElementById('filtroCategoria').value;
            const status = document.getElementById('filtroStatus').value;
            const dataInicio = document.getElementById('dataInicio').value;
            const dataFim = this.value;
            atualizarDashboard(categoria, status, dataInicio, dataFim);
        });
        
        // Add logout button to navbar
        addLogoutButton();
        
        // PDF generation
        document.getElementById('gerarPDF').addEventListener('click', gerarRelatorioPDF);
        
        // History button
        document.getElementById('verHistorico').addEventListener('click', function() {
            // Implementation for viewing history
            alert('Funcionalidade de histórico será implementada em breve!');
        });
    });
})

function getCategoriaText(categoria, subcategoria) {
    let texto = '';
    
    switch(categoria) {
        case 'medicamentos':
            texto = 'Medicamentos Estratégicos';
            if (subcategoria === 'psicotropicos') {
                texto = 'Medicamentos (Psicotrópicos)';
            } else if (subcategoria === 'antibioticos') {
                texto = 'Medicamentos (Antibióticos)';
            } else if (subcategoria === 'vasoativas') {
                texto = 'Medicamentos (Drogas Vasoativas)';
            }
            break;
        case 'materiais':
            texto = 'Materiais Estratégicos';
            break;
        case 'dietas':
            texto = 'Dietas Estratégicas';
            break;
        default:
            texto = categoria;
    }
    
    return texto;
}

function getStatusText(diasDisponiveis) {
    if (diasDisponiveis <= 15) {
        return 'Crítico';
    } else if (diasDisponiveis <= 30) {
        return 'Alerta';
    } else {
        return 'Normal';
    }
}

function addLogoutButton() {
    const navbarNav = document.getElementById('navbarNav');
    const logoutLi = document.createElement('li');
    logoutLi.className = 'nav-item ms-3';
    
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-outline-light';
    logoutBtn.textContent = 'Sair';
    logoutBtn.addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            window.location.href = 'login.html';
        });
    });
    
    logoutLi.appendChild(logoutBtn);
    navbarNav.appendChild(logoutLi);
}