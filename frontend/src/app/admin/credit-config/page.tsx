"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Coins, Save, ArrowLeft, RotateCcw } from "lucide-react";

const categoryLabels: Record<string, string> = {
  content: "Conteúdo",
  distribution: "Distribuição",
  speaking: "Speaking",
  lessons: "Aulas",
  whatsapp: "WhatsApp",
  admin: "Administrativo",
};

const categoryColors: Record<string, string> = {
  content: "bg-blue-100 text-blue-700",
  distribution: "bg-green-100 text-green-700",
  speaking: "bg-purple-100 text-purple-700",
  lessons: "bg-amber-100 text-amber-700",
  whatsapp: "bg-cyan-100 text-cyan-700",
  admin: "bg-gray-100 text-gray-700",
};

export default function AdminCreditConfigPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  const fetchConfigs = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id || user.role !== 'ADMIN') {
      router.push("/dashboard");
      return;
    }
    try {
      setLoading(true);
      const res = await api.get("/credits/config");
      setConfigs(res.data);
      res.data.forEach((c: any) => {
        setEditValues((prev) => ({ ...prev, [c.key]: String(c.current_cost) }));
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, [isHydrated, user, router]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  useEffect(() => {
    document.title = "Talkion - Configuração de Créditos";
  }, []);

  const handleSave = async (key: string) => {
    const value = parseInt(editValues[key]);
    if (isNaN(value) || value < 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(key);
    try {
      await api.patch(`/credits/config/${key}`, { current_cost: value });
      toast.success("Custo atualizado com sucesso!");
      await fetchConfigs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao salvar");
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (config: any) => {
    setEditValues((prev) => ({ ...prev, [config.key]: String(config.default_cost) }));
    setSaving(config.key);
    try {
      await api.patch(`/credits/config/${config.key}`, { current_cost: config.default_cost });
      toast.success("Custo resetado para o padrão!");
      await fetchConfigs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao resetar");
    } finally {
      setSaving(null);
    }
  };

  const grouped = configs.reduce<Record<string, any[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    acc[c.category].sort((a, b) => a.name.localeCompare(b.name));
    return acc;
  }, {});

  if (!isHydrated || loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p>Carregando...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configuração de Créditos</h1>
            <p className="text-muted-foreground mt-1">
              Defina quantos créditos cada ação da plataforma consumirá
            </p>
          </div>
        </div>

        {Object.entries(grouped).map(([category, items]) => (
          <Card key={category} className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                {categoryLabels[category] || category}
              </CardTitle>
              <CardDescription>
                Custos atuais para ações de {categoryLabels[category]?.toLowerCase() || category}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Ação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-32 text-center">Padrão</TableHead>
                    <TableHead className="w-32 text-center">Atual</TableHead>
                    <TableHead className="w-48 text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((config: any) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {config.description}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium">
                          {config.default_cost}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={editValues[config.key] ?? config.current_cost}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, [config.key]: e.target.value }))
                          }
                          className="h-8 w-20 text-center mx-auto text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 px-3 text-xs gap-1"
                            onClick={() => handleSave(config.key)}
                            disabled={saving === config.key}
                          >
                            <Save className="h-3.5 w-3.5" />
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleReset(config)}
                            disabled={saving === config.key}
                            title="Resetar para o valor padrão"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </main>
    </>
  );
}
