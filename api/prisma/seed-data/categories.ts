// Seed categories — the seven core professional courses (Chapter I, Objectives).
// Generated from the approved prototype. Edit here, then re-run: npm run prisma:seed

export interface SeedCategory {
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const categories: SeedCategory[] = [
  { slug: "prog", name: "Computer Programming", icon: "💻", color: "#6C4CF1", description: "Variables, control structures, OOP, and tracing code output." },
  { slug: "dsa", name: "Data Structures and Algorithms", icon: "🌳", color: "#0EA5E9", description: "Stacks, queues, trees, searching, sorting, and complexity." },
  { slug: "dbms", name: "Database Management Systems", icon: "🗄️", color: "#F59E0B", description: "Keys, SQL, ERD, normalization, and transactions." },
  { slug: "net", name: "Data Communications and Networking", icon: "🌐", color: "#10B981", description: "Topologies, OSI model, protocols, ports, and subnetting." },
  { slug: "web", name: "Web Systems and Technologies", icon: "🧩", color: "#EC4899", description: "HTML, CSS, JavaScript, HTTP, and the DOM." },
  { slug: "sad", name: "Systems Analysis and Design", icon: "📐", color: "#8B5CF6", description: "SDLC, UML diagrams, feasibility, and testing." },
  { slug: "ias", name: "Information Assurance and Security", icon: "🛡️", color: "#EF4444", description: "CIA triad, attacks, authentication, and encryption." },
];
