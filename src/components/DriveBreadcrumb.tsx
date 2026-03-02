import { ChevronRight, HardDrive } from "lucide-react";

export interface BreadcrumbItem {
  id: string;
  nome: string;
  tipo: "cliente" | "projeto" | "pasta";
}

interface DriveBreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (index: number) => void;
}

const DriveBreadcrumb = ({ items, onNavigate }: DriveBreadcrumbProps) => {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto py-2">
      <button
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <HardDrive className="h-4 w-4" />
        <span className="font-medium">Drive</span>
      </button>
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => onNavigate(index)}
            className={`font-medium transition-colors ${
              index === items.length - 1
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.nome}
          </button>
        </div>
      ))}
    </nav>
  );
};

export default DriveBreadcrumb;
