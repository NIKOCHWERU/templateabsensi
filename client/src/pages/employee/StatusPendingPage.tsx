import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Clock, CheckCircle2, ShieldAlert, LogOut, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function StatusPendingPage() {
  const { user, logout } = useAuth();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };

  const isRejected = user?.registrationStatus === 'rejected';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-none shadow-2xl shadow-slate-200/50 text-center p-6 sm:p-8">
        <CardHeader className="pb-2">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 ${isRejected ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500 animate-pulse'}`}>
            {isRejected ? <ShieldAlert className="w-10 h-10" /> : <Clock className="w-10 h-10" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {isRejected ? "Pendaftaran Ditolak" : "Menunggu Verifikasi"}
          </CardTitle>
          <CardDescription className="text-slate-500 mt-2 text-base">
            {isRejected 
              ? "Mohon maaf, data pendaftaran Anda ditolak oleh Admin. Silakan hubungi HR atau lengkapi kembali data Anda."
              : "Terima kasih telah melengkapi data. Admin (HR) akan memverifikasi data Anda dalam waktu 1x24 jam."
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="py-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Nama:</span>
              <span className="font-semibold text-slate-900">{user?.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">NIK:</span>
              <span className="font-semibold text-slate-900">{user?.nik}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {user?.registrationStatus}
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-4">
          {!isRejected && (
            <Button onClick={handleRefresh} className="w-full h-11 font-bold shadow-lg shadow-primary/20">
              <RefreshCw className="w-4 h-4 mr-2" /> Segarkan Status
            </Button>
          )}
          
          {isRejected && (
            <Button 
              onClick={() => window.location.href = "/employee/registration"} 
              variant="default"
              className="w-full h-11 font-bold"
            >
              Lengkapi Ulang Data
            </Button>
          )}

          <Button variant="ghost" onClick={() => logout()} className="w-full text-slate-500 hover:text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
