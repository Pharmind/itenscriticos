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
        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            throw new Error("jsPDF library not loaded properly");
        }
        
        const doc = new jsPDF();
        
        // Get filtered items data for report
        const itens = currentFilteredItems;
        
        // Set up PDF header
        doc.setFontSize(16);
        doc.setTextColor(0, 51, 153);
        doc.text("Relatório de Estoque - PharmaView", 15, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Sistema de Gerenciamento de Estoque Hospitalar", 15, 28);
        
        // Add date of generation
        const today = new Date();
        doc.text(`Data de geração: ${today.toLocaleDateString('pt-BR')} às ${today.toLocaleTimeString('pt-BR')}`, 15, 36);
        
        // Count statistics
        let itemsCriticos = 0;
        let itemsAlerta = 0;
        let itemsNormais = 0;
        
        // Additional analytics data
        let medicamentosCount = 0;
        let materiaisCount = 0;
        let dietasCount = 0;
        let psicotropicosCount = 0;
        let antibioticosCount = 0;
        let vasoativasCount = 0;
        let estoqueTotal = 0;
        let consumoDiarioTotal = 0;
        
        // Create table data
        const tableData = [];
        const tableColumns = [
            {title: "Código", dataKey: "codigo"},
            {title: "Nome", dataKey: "nome"},
            {title: "Estoque", dataKey: "estoque"},
            {title: "Consumo Diário", dataKey: "consumo"},
            {title: "Disponibilidade", dataKey: "disponibilidade"},
            {title: "Status", dataKey: "status"}
        ];
        
        // Process items for table and analytics
        itens.forEach(item => {
            const diasPassados = item.timestamp ? Math.floor((new Date() - new Date(item.timestamp.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0;
            const diasConsumidos = diasPassados * item.consumoDiario;
            const estoqueAtual = Math.max(0, item.estoque - diasConsumidos);
            const diasDisponiveis = Math.floor(estoqueAtual / item.consumoDiario);
            
            // Categorize by status
            if (diasDisponiveis <= 15) {
                itemsCriticos++;
            } else if (diasDisponiveis <= 30) {
                itemsAlerta++;
            } else {
                itemsNormais++;
            }
            
            // Categorize by type
            if (item.categoria === 'medicamentos') {
                medicamentosCount++;
                if (item.subcategoria === 'psicotropicos') psicotropicosCount++;
                if (item.subcategoria === 'antibioticos') antibioticosCount++;
                if (item.subcategoria === 'vasoativas') vasoativasCount++;
            } else if (item.categoria === 'materiais') {
                materiaisCount++;
            } else if (item.categoria === 'dietas') {
                dietasCount++;
            }
            
            // Calculate totals
            estoqueTotal += estoqueAtual;
            consumoDiarioTotal += item.consumoDiario;
            
            tableData.push({
                codigo: item.codigo,
                nome: item.nome,
                estoque: estoqueAtual.toFixed(1),
                consumo: item.consumoDiario.toString(),
                disponibilidade: `${diasDisponiveis} dias`,
                status: getStatusText(diasDisponiveis)
            });
        });
        
        // Generate table - use the safer approach with direct property access
        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: 45,
                head: [["Código", "Nome", "Estoque", "Consumo Diário", "Disponibilidade", "Status"]],
                body: tableData.map(row => [
                    row.codigo,
                    row.nome,
                    row.estoque,
                    row.consumo,
                    row.disponibilidade,
                    row.status
                ]),
                theme: 'grid',
                headStyles: {
                    fillColor: [13, 110, 253],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                alternateRowStyles: {
                    fillColor: [240, 240, 240]
                },
                didDrawPage: function(data) {
                    // Add footer to each page
                    let pageSize = doc.internal.pageSize;
                    let pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                    doc.setFontSize(8);
                    doc.setTextColor(100, 100, 100);
                    const pageWidth = pageSize.getWidth();
                    doc.text('PharmaView - Sistema de Gerenciamento Farmacêutico', data.settings.margin.left, pageHeight - 10);
                    doc.text('Página ' + doc.internal.getCurrentPageInfo().pageNumber + ' de ' + doc.internal.getNumberOfPages(), pageWidth - 20, pageHeight - 10);
                }
            });
        } else {
            // Fallback for when autoTable is not available
            doc.text("Não foi possível gerar a tabela. O plugin AutoTable não está disponível.", 15, 45);
            
            // Simple table without autoTable
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            
            let yPos = 55;
            // Headers
            doc.setFillColor(13, 110, 253);
            doc.rect(15, yPos, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text("Código", 18, yPos + 5);
            doc.text("Nome", 45, yPos + 5);
            doc.text("Estoque", 100, yPos + 5);
            doc.text("Consumo", 125, yPos + 5);
            doc.text("Dias", 150, yPos + 5);
            doc.text("Status", 175, yPos + 5);
            
            yPos += 10;
            
            // Table rows (limited to first 20 items to avoid overflow)
            doc.setTextColor(0, 0, 0);
            const maxItems = Math.min(tableData.length, 20);
            for (let i = 0; i < maxItems; i++) {
                const row = tableData[i];
                doc.text(row.codigo, 18, yPos);
                
                // Truncate long names
                let nome = row.nome;
                if (nome.length > 25) nome = nome.substring(0, 22) + "...";
                doc.text(nome, 45, yPos);
                
                doc.text(row.estoque, 100, yPos);
                doc.text(row.consumo, 125, yPos);
                doc.text(row.disponibilidade.replace(" dias", ""), 150, yPos);
                doc.text(row.status, 175, yPos);
                
                yPos += 7;
            }
            
            if (tableData.length > maxItems) {
                doc.text(`... e mais ${tableData.length - maxItems} itens (relatório completo indisponível sem o plugin AutoTable)`, 15, yPos + 5);
            }
        }
        
        // Add Executive Summary page
        doc.addPage();
        
        // Executive Summary Header
        doc.setFontSize(18);
        doc.setTextColor(0, 51, 153);
        doc.text("Sumário Executivo", 15, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Análise consolidada do estoque atual", 15, 28);
        
        // Overview section
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Visão Geral do Estoque", 15, 40);
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Este relatório analisa ${itens.length} itens no estoque em ${today.toLocaleDateString('pt-BR')}. A análise revela que:`, 15, 50);
        
        // Status breakdown with percentages
        const totalItems = itemsCriticos + itemsAlerta + itemsNormais;
        const criticosPercent = Math.round((itemsCriticos / totalItems) * 100) || 0;
        const alertaPercent = Math.round((itemsAlerta / totalItems) * 100) || 0;
        const normaisPercent = Math.round((itemsNormais / totalItems) * 100) || 0;
        
        let yPos = 60;
        
        // Status breakdown with colored indicators
        doc.setFillColor(255, 99, 132); // Red for critical
        doc.rect(15, yPos, 8, 8, 'F');
        doc.text(`Itens críticos: ${itemsCriticos} (${criticosPercent}%) - Requerem atenção imediata`, 28, yPos + 6);
        yPos += 12;
        
        doc.setFillColor(255, 205, 86); // Yellow for alert
        doc.rect(15, yPos, 8, 8, 'F');
        doc.text(`Itens em alerta: ${itemsAlerta} (${alertaPercent}%) - Monitoramento necessário`, 28, yPos + 6);
        yPos += 12;
        
        doc.setFillColor(75, 192, 192); // Green for normal
        doc.rect(15, yPos, 8, 8, 'F');
        doc.text(`Itens normais: ${itemsNormais} (${normaisPercent}%) - Níveis adequados`, 28, yPos + 6);
        yPos += 20;
        
        // Analysis by category
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Distribuição por Categoria", 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        // Category breakdown with percentages
        const medPercent = Math.round((medicamentosCount / totalItems) * 100) || 0;
        const matPercent = Math.round((materiaisCount / totalItems) * 100) || 0;
        const dietaPercent = Math.round((dietasCount / totalItems) * 100) || 0;
        
        // Category breakdown with different colors
        doc.setFillColor(54, 162, 235); // Blue for medications
        doc.rect(15, yPos, 8, 8, 'F');
        doc.text(`Medicamentos: ${medicamentosCount} (${medPercent}%)`, 28, yPos + 6);
        yPos += 12;
        
        if (medicamentosCount > 0) {
            // Subcategories indented
            doc.text(`- Dos quais: ${psicotropicosCount} psicotrópicos, ${antibioticosCount} antibióticos, ${vasoativasCount} drogas vasoativas`, 30, yPos + 6);
            yPos += 12;
        }
        
        doc.setFillColor(153, 102, 255); // Purple for materials
        doc.rect(15, yPos, 8, 8, 'F');
        doc.text(`Materiais: ${materiaisCount} (${matPercent}%)`, 28, yPos + 6);
        yPos += 12;
        
        doc.setFillColor(255, 159, 64); // Orange for diets
        doc.rect(15, yPos, 8, 8, 'F');
        doc.text(`Dietas: ${dietasCount} (${dietaPercent}%)`, 28, yPos + 6);
        yPos += 20;
        
        // Consumption analysis
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Análise de Consumo", 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const avgConsumoDiario = (consumoDiarioTotal / totalItems).toFixed(2);
        const consumoMensalEstimado = (consumoDiarioTotal * 30).toFixed(2);
        const diasEstimados = estoqueTotal > 0 ? Math.floor(estoqueTotal / consumoDiarioTotal) : 0;
        
        doc.text(`• Consumo diário médio por item: ${avgConsumoDiario} unidades`, 15, yPos + 6);
        yPos += 12;
        doc.text(`• Consumo mensal estimado para todos os itens: ${consumoMensalEstimado} unidades`, 15, yPos + 6);
        yPos += 12;
        doc.text(`• Dias médios de abastecimento com estoque atual: ${diasEstimados} dias`, 15, yPos + 6);
        yPos += 12;
        
        // Critical items analysis
        if (itemsCriticos > 0) {
            yPos += 8;
            doc.setFontSize(14);
            doc.setTextColor(0, 51, 153);
            doc.text("Análise de Itens Críticos", 15, yPos);
            yPos += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            
            const itemsCriticosList = tableData
                .filter(item => item.status === 'Crítico')
                .sort((a, b) => parseInt(a.disponibilidade) - parseInt(b.disponibilidade));
            
            doc.text("Os 5 itens mais críticos que requerem atenção imediata:", 15, yPos + 6);
            yPos += 12;
            
            const topCritical = itemsCriticosList.slice(0, 5);
            topCritical.forEach((item, index) => {
                doc.text(`${index + 1}. ${item.nome} (${item.disponibilidade}) - Código: ${item.codigo}`, 20, yPos + 6);
                yPos += 8;
            });
        }
        
        // Add Strategic Recommendations page
        doc.addPage();
        
        // Recommendations Header
        doc.setFontSize(18);
        doc.setTextColor(0, 51, 153);
        doc.text("Recomendações Estratégicas", 15, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Ações sugeridas com base na análise de dados", 15, 28);
        
        yPos = 40;
        
        // Immediate Actions section
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Ações Imediatas", 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const recommendationsImmediate = [
            `1. Priorizar a reposição dos ${itemsCriticos} itens em estado crítico, especialmente aqueles com maior consumo diário.`,
            "2. Realizar conferência física do estoque dos itens críticos para confirmar a precisão dos dados registrados no sistema.",
            "3. Avaliar a possibilidade de remanejamento interno para suprir itens críticos de uso essencial."
        ];
        
        recommendationsImmediate.forEach(rec => {
            // Add a small bullet point
            doc.setFillColor(255, 99, 132); // Red for critical actions
            doc.circle(15, yPos + 3, 1.5, 'F');
            
            // Wrap text if needed
            const textLines = doc.splitTextToSize(rec, 170);
            doc.text(textLines, 20, yPos + 4);
            yPos += 8 * textLines.length + 4;
        });
        
        yPos += 8;
        
        // Short-term Actions section
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Ações de Curto Prazo (30 dias)", 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const recommendationsShortTerm = [
            `1. Monitorar diariamente os ${itemsAlerta} itens em estado de alerta, criando um painel de acompanhamento específico.`,
            "2. Revisar os processos de abastecimento dos itens que transitaram de 'normal' para 'alerta' no último mês.",
            "3. Realizar análise das tendências de consumo, comparando com períodos anteriores para identificar variações significativas.",
            "4. Ajustar os parâmetros de consumo diário de acordo com os dados reais de utilização."
        ];
        
        recommendationsShortTerm.forEach(rec => {
            // Add a small bullet point
            doc.setFillColor(255, 205, 86); // Yellow for short-term actions
            doc.circle(15, yPos + 3, 1.5, 'F');
            
            // Wrap text if needed
            const textLines = doc.splitTextToSize(rec, 170);
            doc.text(textLines, 20, yPos + 4);
            yPos += 8 * textLines.length + 4;
        });
        
        yPos += 8;
        
        // Strategic Actions section
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Ações Estratégicas (90 dias)", 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const recommendationsLongTerm = [
            "1. Implementar sistema de previsão de demanda baseado em dados históricos e sazonalidade.",
            "2. Revisar a classificação de criticidade dos itens e ajustar os estoques mínimos e ponto de ressuprimento.",
            `3. Analisar o perfil de consumo dos ${itemsNormais} itens com estoque normal para identificar oportunidades de otimização e economia.`,
            "4. Propor programa de educação continuada sobre uso racional de medicamentos e materiais para médicos e enfermeiros."
        ];
        
        recommendationsLongTerm.forEach(rec => {
            // Add a small bullet point
            doc.setFillColor(75, 192, 192); // Green for strategic actions
            doc.circle(15, yPos + 3, 1.5, 'F');
            
            // Wrap text if needed
            const textLines = doc.splitTextToSize(rec, 170);
            doc.text(textLines, 20, yPos + 4);
            yPos += 8 * textLines.length + 4;
        });
        
        yPos += 12;
        
        // Conclusion
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Conclusão", 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const conclusion = `Este relatório fornece uma visão completa do estado atual do estoque, com ênfase nos itens críticos que necessitam de atenção imediata. A implementação das recomendações propostas permitirá otimizar a gestão de estoque, reduzir custos operacionais e garantir o fornecimento contínuo de medicamentos e materiais essenciais para o atendimento aos pacientes.`;
        
        const conclusionLines = doc.splitTextToSize(conclusion, 180);
        doc.text(conclusionLines, 15, yPos);
        
        // Add Purchase Suggestion page
        doc.addPage();
        
        // Purchase Suggestions Header
        doc.setFontSize(18);
        doc.setTextColor(0, 51, 153);
        doc.text("Sugestão de Compra", 15, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Recomendações para manter níveis de estoque para 45 dias", 15, 28);
        
        yPos = 40;
        
        // Purchase planning explanation
        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Planejamento de Compras", 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const purchaseExplanation = "A tabela abaixo apresenta sugestões de quantidades a serem adquiridas para manter um estoque adequado para 45 dias de consumo. O cálculo considera o consumo diário de cada item, o estoque atual e a meta de 45 dias de cobertura.";
        const explanationLines = doc.splitTextToSize(purchaseExplanation, 180);
        doc.text(explanationLines, 15, yPos);
        yPos += explanationLines.length * 7 + 10;
        
        // Purchase suggestion table header
        const purchaseTableData = [];
        
        // Process items for purchase suggestion table
        itens.forEach(item => {
            const diasPassados = item.timestamp ? Math.floor((new Date() - new Date(item.timestamp.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0;
            const diasConsumidos = diasPassados * item.consumoDiario;
            const estoqueAtual = Math.max(0, item.estoque - diasConsumidos);
            const diasDisponiveis = Math.floor(estoqueAtual / item.consumoDiario);
            
            // Calculate needed stock for 45 days
            const estoqueNecessario45Dias = Math.ceil(item.consumoDiario * 45);
            
            // Calculate how much we need to buy to reach 45 days
            const quantidadeCompra = Math.max(0, estoqueNecessario45Dias - estoqueAtual);
            
            // Only add items that need purchasing
            if (quantidadeCompra > 0) {
                purchaseTableData.push({
                    codigo: item.codigo,
                    nome: item.nome,
                    categoria: getCategoriaText(item.categoria, item.subcategoria),
                    estoque: estoqueAtual.toFixed(1),
                    consumoDiario: item.consumoDiario.toString(),
                    dias: diasDisponiveis,
                    necessario: estoqueNecessario45Dias,
                    comprar: quantidadeCompra,
                    prioridade: diasDisponiveis <= 15 ? "Alta" : (diasDisponiveis <= 30 ? "Média" : "Baixa")
                });
            }
        });
        
        // Sort by priority (highest first)
        purchaseTableData.sort((a, b) => {
            const prioridadeOrder = { "Alta": 0, "Média": 1, "Baixa": 2 };
            return prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
        });
        
        // Create purchase suggestion table
        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: yPos,
                head: [["Código", "Nome", "Categoria", "Estoque Atual", "Consumo Diário", "Dias Disponíveis", "Necessário p/ 45 dias", "Qtd. Compra", "Prioridade"]],
                body: purchaseTableData.map(row => [
                    row.codigo,
                    row.nome,
                    row.categoria,
                    row.estoque,
                    row.consumoDiario,
                    row.dias,
                    row.necessario,
                    row.comprar,
                    row.prioridade
                ]),
                theme: 'grid',
                headStyles: {
                    fillColor: [13, 110, 253],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                columnStyles: {
                    7: {fontStyle: 'bold'}, // Bold the purchase quantity
                    8: {
                        // Color the priority column based on value
                        customCellStyles: (cell, data) => {
                            if (data.cell.text[0] === 'Alta') {
                                return { fillColor: [255, 99, 132, 0.3] };
                            } else if (data.cell.text[0] === 'Média') {
                                return { fillColor: [255, 205, 86, 0.3] };
                            } else {
                                return { fillColor: [75, 192, 192, 0.3] };
                            }
                        }
                    }
                },
                alternateRowStyles: {
                    fillColor: [240, 240, 240]
                },
                margin: { top: 15, right: 15, bottom: 15, left: 15 },
                didDrawPage: function(data) {
                    // Add footer to each page
                    let pageSize = doc.internal.pageSize;
                    let pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                    let pageWidth = pageSize.getWidth ? pageSize.getWidth() : pageSize.width;
                    doc.setFontSize(8);
                    doc.setTextColor(100, 100, 100);
                    doc.text('PharmaView - Sistema de Gerenciamento Farmacêutico', data.settings.margin.left, pageHeight - 10);
                    doc.text('Página ' + doc.internal.getCurrentPageInfo().pageNumber + ' de ' + doc.internal.getNumberOfPages(), pageWidth - 20, pageHeight - 10);
                }
            });
        } else {
            // Fallback for when autoTable is not available
            doc.text("Não foi possível gerar a tabela de sugestão de compras. O plugin AutoTable não está disponível.", 15, yPos);
            
            // Simple alternative table
            yPos += 10;
            doc.setFontSize(8);
            doc.text("Itens com prioridade Alta para compra:", 15, yPos);
            yPos += 8;
            
            const highPriorityItems = purchaseTableData.filter(item => item.prioridade === "Alta").slice(0, 5);
            highPriorityItems.forEach((item, index) => {
                doc.text(`${index + 1}. ${item.nome} - Comprar: ${item.comprar} unidades`, 20, yPos);
                yPos += 6;
            });
        }

        // Summary section after table
        yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : yPos + 20;

        // Check if there's enough space for the summary section
        if (yPos > 240) { // If we're too close to bottom of page
            doc.addPage(); // Add a new page
            yPos = 20; // Reset Y position at top of new page
        }

        doc.setFontSize(14);
        doc.setTextColor(0, 51, 153);
        doc.text("Resumo de Compras", 15, yPos);
        yPos += 10;

        // Calculate summary statistics
        const totalItens = purchaseTableData.length;
        const totalUnidades = purchaseTableData.reduce((sum, item) => sum + parseInt(item.comprar), 0);
        const itensPrioridadeAlta = purchaseTableData.filter(item => item.prioridade === "Alta").length;
        const itensPrioridadeMedia = purchaseTableData.filter(item => item.prioridade === "Média").length;
        const itensPrioridadeBaixa = purchaseTableData.filter(item => item.prioridade === "Baixa").length;
        
        doc.text(`• Total de itens para compra: ${totalItens} itens`, 15, yPos);
        yPos += 8;

        if (yPos > 270) { // Check if approaching page bottom
            doc.addPage();
            yPos = 20;
        }

        doc.text(`• Quantidade total a ser adquirida: ${totalUnidades} unidades`, 15, yPos);
        yPos += 8;

        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }

        doc.text(`• Itens de prioridade alta: ${itensPrioridadeAlta} (${Math.round((itensPrioridadeAlta/totalItens)*100)}%)`, 15, yPos);
        yPos += 8;

        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }

        doc.text(`• Itens de prioridade média: ${itensPrioridadeMedia} (${Math.round((itensPrioridadeMedia/totalItens)*100)}%)`, 15, yPos);
        yPos += 8;

        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }

        doc.text(`• Itens de prioridade baixa: ${itensPrioridadeBaixa} (${Math.round((itensPrioridadeBaixa/totalItens)*100)}%)`, 15, yPos);

        // Add footer to this page as well
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            const pageSize = doc.internal.pageSize;
            const pageWidth = pageSize.getWidth();
            doc.text(`Página ${i} de ${pageCount} | PharmaView - Sistema de Gerenciamento Farmacêutico`, pageWidth / 2, 287, { align: 'center' });
        }
        
        // Save PDF
        doc.save('relatorio-analise-estoque.pdf');
        
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert(`Erro ao gerar relatório: ${error.message}. Por favor, verifique se todas as bibliotecas foram carregadas corretamente.`);
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