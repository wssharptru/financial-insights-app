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
 * Generates a list of high-quality, manually written FAQs.
 * @returns {Promise<Array<Object>>} A list of FAQ items.
 */
async function generateFaqs() {
    // Manually written FAQs with step-by-step instructions
    const faqs = [
        {
            question: 'How do I get started with the AI Finance dashboard?',
            answer: `
                <p>Welcome! Here’s how to get started:</p>
                <ol>
                    <li><strong>Sign In:</strong> If you're new, sign up for an account. Otherwise, sign in with your credentials.</li>
                    <li><strong>Explore the Dashboard:</strong> The dashboard gives you a quick overview of your portfolio, budget, and AI-powered insights.</li>
                    <li><strong>Navigate:</strong> Use the sidebar to navigate to different sections like Portfolio, Budget, and the AI Stock Screener.</li>
                </ol>
            `,
            category: 'Getting Started',
            source: 'manual'
        },
        {
            question: 'How do I add a new asset to my portfolio?',
            answer: `
                <p>To add a new asset (like a stock or cryptocurrency) to your portfolio, follow these steps:</p>
                <ol>
                    <li>Navigate to the <strong>Portfolio</strong> page from the sidebar.</li>
                    <li>Click the "Add Asset" button.</li>
                    <li>In the form that appears, enter the asset's ticker symbol (e.g., AAPL for Apple Inc.), the quantity you own, and the purchase date.</li>
                    <li>Click "Save Asset." The new asset will be added to your portfolio, and its value will be tracked automatically.</li>
                </ol>
            `,
            category: 'Portfolio Tracking',
            source: 'manual'
        },
        {
            question: 'How do I create and manage a budget?',
            answer: `
                <p>The Budget Worksheet helps you manage your income and expenses. Here's how to use it:</p>
                <ol>
                    <li>Go to the <strong>Budget Worksheet</strong> page from the sidebar.</li>
                    <li><strong>Add Income Sources:</strong> Enter your sources of income (e.g., salary, freelance work) and their monthly amounts.</li>
                    <li><strong>Add Expenses:</strong> List your monthly expenses (e.g., rent, groceries, utilities) and their estimated costs.</li>
                    <li><strong>Track Your Spending:</strong> The worksheet will automatically calculate your total income, total expenses, and net savings.</li>
                    <li><strong>Export Your Budget:</strong> You can export your budget as a PDF or Excel file using the buttons at the top of the page.</li>
                </ol>
            `,
            category: 'Budget Tool',
            source: 'manual'
        },
        {
            question: 'What is the AI Stock Screener and how do I use it?',
            answer: `
                <p>The AI Stock Screener helps you discover new investment opportunities. Here's how it works:</p>
                <ol>
                    <li>Navigate to the <strong>AI Stock Screener</strong> page.</li>
                    <li><strong>Set Your Criteria:</strong> Use the filters to define what you're looking for in a stock (e.g., market cap, P/E ratio, dividend yield).</li>
                    <li><strong>Get AI Recommendations:</strong> The screener will provide a list of stocks that match your criteria, along with an AI-powered "buy," "hold," or "sell" recommendation.</li>
                    <li><strong>View Asset Profiles:</strong> Click on any stock in the list to view its detailed asset profile.</li>
                </ol>
            `,
            category: 'AI Stock Screener',
            source: 'manual'
        },
        {
            question: 'What are AI Insights?',
            answer: `
                <p>The AI Insights page provides personalized financial advice based on your portfolio and budget data. The AI analyzes your financial situation and may suggest actions such as:</p>
                <ul>
                    <li>Diversifying your portfolio if it's too concentrated in one asset.</li>
                    <li>Identifying areas where you could save money in your budget.</li>
                    <li>Highlighting investment opportunities that align with your goals.</li>
                </ul>
            `,
            category: 'AI Insights',
            source: 'manual'
        },
        {
            question: 'How can I change my preferences?',
            answer: `
                <p>You can customize your experience in the Preferences page:</p>
                <ol>
                    <li>Go to the <strong>Preferences</strong> page from the sidebar.</li>
                    <li>Here, you can change settings like your preferred currency, notification settings, and the theme of the application (e.g., light or dark mode).</li>
                    <li>Click "Save Changes" to apply your new preferences.</li>
                </ol>
            `,
            category: 'Preferences',
            source: 'manual'
        },
        {
            question: 'How do I sign out securely?',
            answer: `
                <p>To sign out of your account:</p>
                <ol>
                    <li>Locate the <strong>Sign Out</strong> button at the bottom of the sidebar.</li>
                    <li>Click the button. You will be securely logged out and redirected to the sign-in page.</li>
                </ol>
            `,
            category: 'Getting Started',
            source: 'manual'
        },
        {
            question: 'What do the AI stock recommendations ("buy", "hold", "sell") mean?',
            answer: `
                <p>The AI recommendations are generated based on a combination of market data, historical performance, and predictive analytics. Here’s a general guide to their meaning:</p>
                <ul>
                    <li><strong>Buy:</strong> The AI suggests that this stock is likely to outperform the market. It may be undervalued or have strong growth potential.</li>
                    <li><strong>Hold:</strong> The AI suggests that this stock is likely to perform in line with the market. If you own it, it may be worth holding onto, but it might not be the best time to buy more.</li>
                    <li><strong>Sell:</strong> The AI suggests that this stock is likely to underperform the market. It may be overvalued or face significant headwinds.</li>
                </ul>
                <p><strong>Disclaimer:</strong> These are AI-generated suggestions, not financial advice. Always do your own research before making any investment decisions.</p>
            `,
            category: 'AI Stock Screener',
            source: 'manual'
        }
    ];

    return faqs;
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
                        <h2 class="accordion-header" id="heading-${category.replace(/\s+/g, '-')}-${index}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${category.replace(/\s+/g, '-')}-${index}" aria-expanded="false" aria-controls="collapse-${category.replace(/\s+/g, '-')}-${index}">
                                ${faq.question}
                            </button>
                        </h2>
                        <div id="collapse-${category.replace(/\s+/g, '-')}-${index}" class="accordion-collapse collapse" aria-labelledby="heading-${category.replace(/\s+/g, '-')}-${index}" data-bs-parent="#faq-accordion-${category.replace(/\s+/g, '-')}">
                            <div class="accordion-body">
                                ${faq.answer}
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
                "text": faq.answer.replace(/<[^>]*>/g, '') // Strip HTML for the JSON-LD
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
                const answer = item.querySelector('.accordion-body').textContent.toLowerCase();
                if (question.includes(searchTerm) || answer.includes(searchTerm)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}
