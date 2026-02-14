import re
import json
from PyPDF2 import PdfReader


class ResumeParser:
    """Extract skills, URLs, and profile information from resumes."""

    SKILL_KEYWORDS = {
        # Programming Languages
        "python", "java", "javascript", "typescript", "c++", "c#", "ruby", "go", "golang",
        "rust", "swift", "kotlin", "php", "scala", "perl", "r", "matlab", "dart", "lua",
        "objective-c", "shell", "bash", "powershell", "groovy", "haskell", "elixir",
        "clojure", "erlang", "fortran", "cobol", "assembly", "vhdl", "verilog",

        # Web Frontend
        "html", "css", "react", "reactjs", "react.js", "angular", "angularjs", "vue",
        "vuejs", "vue.js", "svelte", "nextjs", "next.js", "nuxt", "nuxtjs", "gatsby",
        "jquery", "bootstrap", "tailwind", "tailwindcss", "sass", "scss", "less",
        "webpack", "vite", "rollup", "parcel", "babel", "eslint", "prettier",
        "storybook", "material-ui", "mui", "chakra-ui", "ant-design", "redux",
        "zustand", "mobx", "recoil", "context-api", "graphql",

        # Web Backend
        "node", "nodejs", "node.js", "express", "expressjs", "fastapi", "flask",
        "django", "spring", "spring-boot", "springboot", "asp.net", "rails",
        "ruby-on-rails", "laravel", "gin", "fiber", "fastify", "nestjs", "nest.js",
        "koa", "hapi", "strapi", "prisma",

        # Databases
        "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch",
        "cassandra", "dynamodb", "firebase", "firestore", "supabase", "sqlite",
        "oracle", "sql-server", "mariadb", "couchdb", "neo4j", "influxdb",
        "timescaledb", "cockroachdb",

        # Cloud & DevOps
        "aws", "azure", "gcp", "google-cloud", "heroku", "vercel", "netlify",
        "digitalocean", "linode", "cloudflare", "docker", "kubernetes", "k8s",
        "terraform", "ansible", "jenkins", "github-actions", "gitlab-ci", "circleci",
        "travis-ci", "argo-cd", "helm", "istio", "nginx", "apache", "caddy",

        # Data Science & ML
        "machine-learning", "deep-learning", "tensorflow", "pytorch", "keras",
        "scikit-learn", "sklearn", "pandas", "numpy", "scipy", "matplotlib",
        "seaborn", "plotly", "jupyter", "notebook", "anaconda", "opencv",
        "computer-vision", "nlp", "natural-language-processing", "bert", "gpt",
        "transformer", "huggingface", "langchain", "llm", "generative-ai",
        "data-science", "data-analysis", "data-engineering", "spark", "pyspark",
        "hadoop", "airflow", "kafka", "flink", "dbt", "snowflake", "databricks",
        "tableau", "power-bi", "looker",

        # Mobile
        "android", "ios", "react-native", "flutter", "xamarin", "ionic",
        "swiftui", "jetpack-compose", "expo",

        # Testing
        "jest", "mocha", "chai", "cypress", "selenium", "playwright", "puppeteer",
        "junit", "pytest", "unittest", "rspec", "testng", "postman", "insomnia",

        # Tools & Others
        "git", "github", "gitlab", "bitbucket", "jira", "confluence", "slack",
        "figma", "sketch", "adobe-xd", "photoshop", "illustrator",
        "rest", "restful", "api", "microservices", "serverless", "websocket",
        "grpc", "oauth", "jwt", "ssl", "tls", "ci-cd", "agile", "scrum",
        "kanban", "tdd", "bdd", "solid", "design-patterns", "oop",
        "functional-programming", "system-design", "dsa", "data-structures",
        "algorithms", "linux", "unix", "windows-server",

        # Blockchain
        "blockchain", "solidity", "ethereum", "web3", "smart-contracts",
        "defi", "nft", "hardhat", "truffle", "metamask",

        # Security
        "cybersecurity", "penetration-testing", "owasp", "encryption",
        "authentication", "authorization", "sso", "ldap", "active-directory",
    }

    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        """Extract text content from a PDF file."""
        try:
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text.strip()
        except Exception as e:
            print(f"Error extracting PDF text: {e}")
            return ""

    @staticmethod
    def extract_text_from_bytes(file_bytes) -> str:
        """Extract text content from PDF bytes."""
        import io
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text.strip()
        except Exception as e:
            print(f"Error extracting PDF text from bytes: {e}")
            return ""

    @classmethod
    def extract_skills(cls, text: str) -> list:
        """Extract technical skills from resume text."""
        text_lower = text.lower()
        # Normalize text for better matching
        text_normalized = re.sub(r'[^a-z0-9\s\-\.\+#]', ' ', text_lower)
        words = set(re.split(r'[\s,;|/\\]+', text_normalized))

        found_skills = []
        for skill in cls.SKILL_KEYWORDS:
            # Check for exact word match
            skill_lower = skill.lower()
            if skill_lower in words:
                found_skills.append(skill)
                continue

            # Check for multi-word skills in text
            if '-' in skill_lower:
                no_dash = skill_lower.replace('-', ' ')
                if no_dash in text_normalized:
                    found_skills.append(skill)
                    continue
                no_dash2 = skill_lower.replace('-', '')
                if no_dash2 in text_normalized:
                    found_skills.append(skill)
                    continue

            # Check for dot variants (e.g., node.js)
            if '.' in skill_lower:
                no_dot = skill_lower.replace('.', '')
                if no_dot in text_normalized:
                    found_skills.append(skill)

        # Deduplicate and sort
        found_skills = sorted(list(set(found_skills)))
        return found_skills

    @staticmethod
    def extract_github_url(text: str) -> str:
        """Extract GitHub profile URL from text."""
        patterns = [
            r'https?://(?:www\.)?github\.com/[\w\-]+',
            r'github\.com/[\w\-]+',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                url = match.group(0)
                if not url.startswith('http'):
                    url = 'https://' + url
                return url
        return ""

    @staticmethod
    def extract_linkedin_url(text: str) -> str:
        """Extract LinkedIn profile URL from text."""
        patterns = [
            r'https?://(?:www\.)?linkedin\.com/in/[\w\-]+',
            r'linkedin\.com/in/[\w\-]+',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                url = match.group(0)
                if not url.startswith('http'):
                    url = 'https://' + url
                return url
        return ""

    @staticmethod
    def extract_coding_platforms(text: str) -> dict:
        """Extract coding platform profile URLs."""
        platforms = {}

        platform_patterns = {
            "leetcode": [
                r'https?://(?:www\.)?leetcode\.com/[\w\-]+',
                r'leetcode\.com/[\w\-]+',
            ],
            "hackerrank": [
                r'https?://(?:www\.)?hackerrank\.com/[\w\-]+',
                r'hackerrank\.com/[\w\-]+',
            ],
            "codeforces": [
                r'https?://(?:www\.)?codeforces\.com/profile/[\w\-]+',
                r'codeforces\.com/profile/[\w\-]+',
            ],
            "codechef": [
                r'https?://(?:www\.)?codechef\.com/users/[\w\-]+',
                r'codechef\.com/users/[\w\-]+',
            ],
            "hackerearth": [
                r'https?://(?:www\.)?hackerearth\.com/@[\w\-]+',
                r'hackerearth\.com/@[\w\-]+',
            ],
            "geeksforgeeks": [
                r'https?://(?:www\.)?geeksforgeeks\.org/user/[\w\-]+',
                r'geeksforgeeks\.org/user/[\w\-]+',
            ],
            "kaggle": [
                r'https?://(?:www\.)?kaggle\.com/[\w\-]+',
                r'kaggle\.com/[\w\-]+',
            ],
            "stackoverflow": [
                r'https?://(?:www\.)?stackoverflow\.com/users/\d+/[\w\-]+',
                r'stackoverflow\.com/users/\d+/[\w\-]+',
            ],
        }

        for platform, patterns in platform_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    url = match.group(0)
                    if not url.startswith('http'):
                        url = 'https://' + url
                    platforms[platform] = url
                    break

        return platforms

    @staticmethod
    def extract_email(text: str) -> str:
        """Extract email address from text."""
        pattern = r'[\w\.\-\+]+@[\w\.\-]+\.\w+'
        match = re.search(pattern, text)
        return match.group(0) if match else ""

    @staticmethod
    def extract_phone(text: str) -> str:
        """Extract phone number from text."""
        patterns = [
            r'[\+]?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
            r'\+?\d{10,13}',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0).strip()
        return ""

    @staticmethod
    def extract_name(text: str) -> str:
        """Attempt to extract name from the first few lines of resume."""
        lines = text.strip().split('\n')
        for line in lines[:5]:
            line = line.strip()
            if line and len(line) < 50 and not re.search(r'[@\(\)\d{5,}]', line):
                # Likely a name if it's a short line without emails/phones
                if re.match(r'^[A-Za-z\s\.\-]+$', line):
                    return line.strip()
        return "Unknown Candidate"

    @classmethod
    def parse_resume(cls, file_path: str = None, file_bytes=None) -> dict:
        """Parse a resume and extract all relevant information."""
        if file_path:
            text = cls.extract_text_from_pdf(file_path)
        elif file_bytes:
            text = cls.extract_text_from_bytes(file_bytes)
        else:
            return {"error": "No file provided"}

        if not text:
            return {"error": "Could not extract text from resume"}

        return {
            "name": cls.extract_name(text),
            "email": cls.extract_email(text),
            "phone": cls.extract_phone(text),
            "skills": cls.extract_skills(text),
            "github_url": cls.extract_github_url(text),
            "linkedin_url": cls.extract_linkedin_url(text),
            "coding_platforms": cls.extract_coding_platforms(text),
            "resume_text": text,
        }
