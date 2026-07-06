import { Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CompanyHeaderProps {
  name?: string;
  logoUrl?: string;
  title?: string;
}

export function CompanyHeader({ name: propName, logoUrl: propLogo, title }: CompanyHeaderProps) {
  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
  });

  const name = propName || config?.singkatanPt || config?.namaPt || import.meta.env.VITE_SINGKATAN_PT || import.meta.env.VITE_NAMA_PT || "PT ABC";
  const logoUrl = propLogo || config?.logoUrl || import.meta.env.VITE_LOGO_FILE || "/logo_elok_buah.jpg";
  const logoInisial = config?.logoInisial || import.meta.env.VITE_LOGO_INISIAL || name.charAt(0);

  const formattedName = name.toUpperCase();
  return (
    <header className="bg-primary text-white shadow-lg pb-12 pt-6 px-6 rounded-b-[2.5rem]">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display tracking-tight text-shadow-sm uppercase">
            {formattedName}
          </h1>
          <p className="text-white/80 text-xs md:text-sm font-medium tracking-wide uppercase">
            ABSENSI TENAGA KERJA {formattedName}
          </p>
        </div>
        <div className="w-16 h-16 md:w-18 md:h-18 bg-white rounded-2xl flex items-center justify-center border border-white/20 shadow-lg p-2 text-3xl font-bold text-primary">
          {logoUrl && logoUrl !== "/logo_elok_buah.jpg" ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            logoInisial
          )}
        </div>
      </div>
      {title && (
        <div className="text-center mt-6 -mb-4">
          <h2 className="text-sm font-black text-white uppercase tracking-widest">{title}</h2>
        </div>
      )}
    </header>
  );
}
