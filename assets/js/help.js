// assets/js/help.js

/**
 * Initializes the Help page functionality.
 */
export async function initHelpPage() {
    const faqs = await generateFaqs();
    renderFaqs(faqs);
    addEventListeners();
}

/**
 * Scans the codebase to generate a list of FAQs.
 * @returns {Promise<Array<Object>>} A list of FAQ items.
 */
async function generateFaqs() {
    const faqs = [];
    const filesToScan = [
        'index.html',
        'pages/dashboard.html',
        'pages/portfolio.html',
        'pages/budget.html',
        'pages/ai-screener.html',
        'pages/insights.html',
        'pages/preferences.html',
        'assets/js/auth.js',
        'assets/js/budget.js',
        'assets/js/portfolio-logic.js',
    ];

    const fetchPromises = filesToScan.map(file => fetch(file).then(res => res.text()));
    const fileContents = await Promise.all(fetchPromises);

    fileContents.forEach((content, index) => {
        const file = filesToScan[index];
        const category = file.split('/')[1]?.split('.')[0] || 'General';

        // Regex to find questions in comments
        const commentRegex = /\/\/\s*(.+)\?/g;
        let match;
        while ((match = commentRegex.exec(content)) !== null) {
            faqs.push({
                question: match[1].trim() + '?',
                answer: 'This is an automatically generated answer based on a comment in the code.',
                category: classifyCategory(match[1]),
                source: file,
            });
        }

        // Regex for h2 headings
        const h2Regex = /<h2[^>]*>(.*?)<\/h2>/g;
        while ((match = h2Regex.exec(content)) !== null) {
            const question = `What is the purpose of the ${match[1].trim()} section?`;
            faqs.push({
                question,
                answer: `The ${match[1].trim()} section allows you to view and manage your ${match[1].toLowerCase().trim()}.`,
                category: classifyCategory(match[1]),
                source: file,
            });
        }

        // Regex for labels
        const labelRegex = /<label[^>]*>(.*?)<\/label>/g;
        while ((match = labelRegex.exec(content)) !== null) {
            const question = `What is "${match[1].trim()}"?`;
            faqs.push({
                question,
                answer: `This refers to a field or option within the application, typically found on a form.`,
                category: classifyCategory(match[1]),
                source: file,
            });
        }
    });

    // Add some default FAQs
    faqs.push(
        {
            question: 'How do I sign out?',
            answer: 'Click the "Sign Out" button at the bottom of the sidebar.',
            category: 'Getting Started',
            source: 'inferred'
        },
        {
            question: 'How is my portfolio value calculated?',
            answer: 'Your portfolio value is the sum of the current market value of all your assets.',
            category: 'Portfolio Tracking',
            source: 'inferred'
        },
        {
            question: 'What is the AI Stock Screener?',
            answer: 'The AI Stock Screener helps you find stocks based on various criteria and AI-powered recommendations.',
            category: 'Budget Tool',
            source: 'inferred'
        },
        {
            question: 'Can I export my budget?',
            answer: 'Yes, you can export your budget as a PDF or Excel file from the Budget Worksheet page.',
            category: 'Budget Tool',
            source: 'inferred'
        },
        {
            question: 'How do I change my preferences?',
            answer: 'Navigate to the "Preferences" page from the sidebar to update your settings.',
            category: 'Preferences',
            source: 'inferred'
        }
    );

    // Remove duplicate questions
    const uniqueFaqs = faqs.filter((faq, index, self) =>
        index === self.findIndex((f) => (
            f.question === faq.question
        ))
    );

    return uniqueFaqs.slice(0, 15);
}

function classifyCategory(text) {
    text = text.toLowerCase();
    if (text.includes('budget')) return 'Budget Tool';
    if (text.includes('portfolio') || text.includes('asset')) return 'Portfolio Tracking';
    if (text.includes('screener')) return 'AI Stock Screener';
    if (text.includes('insight')) return 'AI Insights';
    if (text.includes('preference')) return 'Preferences';
    return 'General';
}

/**
 * Renders the FAQs on the page.
 * @param {Array<Object>} faqs - The list of FAQs to render.
 */
function renderFaqs(faqs) {
    const faqContainer = document.getElementById('faq-container');
    if (!faqContainer) return;

    const categories = [...new Set(faqs.map(faq => faq.category))];

    faqContainer.innerHTML = categories.map(category => `
        <div class="mb-4">
            <h4 class="text-muted">${category}</h4>
            <div class="accordion" id="faq-accordion-${category.replace(/\s+/g, '-')}">
                ${faqs.filter(faq => faq.category === category).map((faq, index) => `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="heading-${index}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}" aria-expanded="false" aria-controls="collapse-${index}">
                                ${faq.question}
                            </button>
                        </h2>
                        <div id="collapse-${index}" class="accordion-collapse collapse" aria-labelledby="heading-${index}" data-bs-parent="#faq-accordion-${category.replace(/\s+/g, '-')}">
                            <div class="accordion-body">
                                <p>${faq.answer}</p>
                                <small class="text-muted">Source: ${faq.source}</small>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Update the JSON-LD schema
    const schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    };
    document.getElementById('faq-schema').textContent = JSON.stringify(schema, null, 2);
}

/**
 * Adds event listeners for the search box.
 */
function addEventListeners() {
    const searchInput = document.getElementById('faq-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const faqItems = document.querySelectorAll('.accordion-item');
            faqItems.forEach(item => {
                const question = item.querySelector('.accordion-button').textContent.toLowerCase();
                const answer = item.querySelector('.accordion-body p').textContent.toLowerCase();
                if (question.includes(searchTerm) || answer.includes(searchTerm)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}
