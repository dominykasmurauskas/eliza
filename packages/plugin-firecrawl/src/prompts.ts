export const shouldCrawlTemplate = `# Task: Determine if the user wants to crawl/read/analyze a website mentioned in their message.

User's message:
{{message}}

Consider:
- Is the user explicitly asking to crawl/read/analyze the website?
- Is the user asking questions about website content?
- Is the URL just mentioned in passing without intent to read it?
- Does the URL contain any file extensions that we don't want to crawl? Unwanted extensions: {{unwantedExtensions}}
- Does the URL contain schema? If not, add https://

Answer format:
{
  "shouldCrawl": boolean,
  "explanation": string,
  "urls": string[]  // URLs to crawl if shouldCrawl is true
}`;

export const extractContentTemplate = `# Task: Extract the most relevant content from a webpage.

Instructions:
1. Remove navigation menus, headers, footers, ads, and other boilerplate content
2. Keep only the main content sections that contain:
   - Key facts and information
   - FAQs
   - Important details about products/services
   - Core documentation content
   - Relevant technical specifications
3. Format the output in clean markdown
4. Preserve the hierarchical structure of important content
5. Remove any duplicate or redundant information

Output only the extracted content in markdown format that can be used as knowledge in RAG vector search.

Content to analyze:
{{htmlContent}}`;