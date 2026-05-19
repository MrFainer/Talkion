"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { toast } from "sonner";
import { MessageSquare, Users, Variable, Save, RotateCcw, SmilePlus } from "lucide-react";

type TextEditorProps = {
  label: string;
  field: string;
  value: string;
  onChange: (field: string, value: string) => void;
  onInsertEmoji: (field: string, emoji: string) => void;
  minHeight?: string;
};

function TextEditor({
  label,
  field,
  value,
  onChange,
  onInsertEmoji,
  minHeight = "min-h-[100px]",
}: TextEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Popover>
          <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-2 text-muted-foreground">
            <SmilePlus className="w-4 h-4 mr-2" /> Emojis
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end" side="top">
            <EmojiPicker
              theme={Theme.AUTO}
              onEmojiClick={(emoji: EmojiClickData) => onInsertEmoji(field, emoji.emoji)}
            />
          </PopoverContent>
        </Popover>
      </div>
      <Textarea
        id={field}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        className={minHeight}
      />
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{value.length} caracteres</span>
      </div>
    </div>
  );
}

function WhatsappFormatGuide() {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 text-sm">
      <h4 className="font-semibold mb-2 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        Guia de Formatação
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-muted-foreground">
        <div>
          <code className="text-foreground bg-background px-1 rounded">*texto*</code>
          <p className="mt-1 font-bold text-foreground">Negrito</p>
        </div>
        <div>
          <code className="text-foreground bg-background px-1 rounded">_texto_</code>
          <p className="mt-1 italic text-foreground">Itálico</p>
        </div>
        <div>
          <code className="text-foreground bg-background px-1 rounded">~texto~</code>
          <p className="mt-1 line-through text-foreground">Tachado</p>
        </div>
        <div>
          <code className="text-foreground bg-background px-1 rounded">`texto`</code>
          <p className="mt-1 font-mono text-xs text-foreground">Monoespaçado</p>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchSettings = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }
    try {
      const res = await api.get(`/message-settings/${user.id}`);
      setSettings(res.data);
    } catch (error) {
      toast.error("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, [isHydrated, user?.id, router]);

  useEffect(() => {
    document.title = "Talkion - Configurações de Mensagens";
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await api.put(`/message-settings/${user.id}`, settings);
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const res = await api.post(`/message-settings/${user.id}/reset`);
      setSettings(res.data);
      toast.success("Configurações restauradas para o padrão.");
    } catch (error) {
      toast.error("Erro ao restaurar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    try {
      await handleReset();
    } finally {
      setIsResetDialogOpen(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const insertTextAtCursor = (field: string, textToInsert: string) => {
    const el = document.getElementById(field) as HTMLTextAreaElement;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentValue = settings?.[field] || "";

    const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
    
    updateSetting(field, newValue);

    // Reposiciona o cursor após a renderização
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 10);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <p>Carregando configurações...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-8 bg-muted/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configurações de Mensagens</h1>
            <p className="text-muted-foreground mt-1">
              Personalize o comportamento do bot e os textos padrão.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsResetDialogOpen(true)}
              disabled={saving}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar Padrão
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restaurar configurações padrão</DialogTitle>
              <DialogDescription>
                Isso vai apagar suas modificações e voltar ao padrão do Talkion.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsResetDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmReset} disabled={saving}>
                {saving ? "Restaurando..." : "Restaurar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="private" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="private" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> <span className="hidden sm:inline">Privado</span>
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> <span className="hidden sm:inline">Grupo</span>
            </TabsTrigger>
            <TabsTrigger value="vars" className="flex items-center gap-2">
              <Variable className="w-4 h-4" /> <span className="hidden sm:inline">Variáveis</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="private" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Comportamento em Conversas no Privado</CardTitle>
                <CardDescription>Configure uma ideia de como a IA vai montar e enviar as mensagens no privado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <WhatsappFormatGuide />

                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextEditor
                      label="Saudação"
                      field="private_greeting_idea"
                      value={settings?.private_greeting_idea || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                    <TextEditor
                      label="Cabeçalho do Desafio"
                      field="private_speaking_intro_idea"
                      value={settings?.private_speaking_intro_idea || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                    <TextEditor
                      label="Cabeçalho da Notícia"
                      field="private_news_intro_idea"
                      value={settings?.private_news_intro_idea || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="group" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Comportamento em Conversas no Grupo</CardTitle>
                <CardDescription>Configure uma ideia de como a IA vai montar e enviar as mensagens no grupo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <WhatsappFormatGuide />

                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextEditor
                      label="Saudação"
                      field="group_greeting_idea"
                      value={settings?.group_greeting_idea || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                    <TextEditor
                      label="Cabeçalho do Quiz do Dia Anterior"
                      field="group_previous_quiz_header_idea"
                      value={settings?.group_previous_quiz_header_idea || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                    <TextEditor
                      label="Cabeçalho da Notícia"
                      field="group_news_intro_idea"
                      value={settings?.group_news_intro_idea || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                    <TextEditor
                      label="Cabeçalho do Quiz"
                      field="group_quiz_header_idea"
                      value={settings?.group_quiz_header_idea || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                    <TextEditor 
                      label="Rodapé do Quiz" 
                      field="group_quiz_footer_message" 
                      value={settings?.group_quiz_footer_message || ""}
                      onChange={updateSetting}
                      onInsertEmoji={insertTextAtCursor}
                      minHeight="min-h-[120px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 
            <TabsContent value="ai" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ambiente e Inteligência Artificial</CardTitle>
                  <CardDescription>Configure o prompt base da IA e limites de uso.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>System Prompt (Comportamento da IA)</Label>
                    <Textarea 
                      value={settings?.system_prompt || ""} 
                      onChange={(e) => updateSetting("system_prompt", e.target.value)}
                      className="min-h-[150px]"
                      placeholder="Ex: Você é um professor de inglês rigoroso..."
                    />
                    <p className="text-xs text-muted-foreground">Instruções globais passadas para a IA em todas as requisições.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Temperatura da IA (0.0 a 1.0)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        min="0" max="1"
                        value={settings?.ai_temperature ?? 0.7} 
                        onChange={(e) => updateSetting("ai_temperature", parseFloat(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">Valores altos = mais criatividade. Valores baixos = mais precisão.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo da IA</Label>
                      <Input 
                        type="text" 
                        value={settings?.ai_model || "gpt-4o-mini"} 
                        onChange={(e) => updateSetting("ai_model", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Mensagens por Minuto</Label>
                      <Input 
                        type="number" 
                        value={settings?.messages_per_minute || 10} 
                        onChange={(e) => updateSetting("messages_per_minute", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Timeout de Resposta (segundos)</Label>
                      <Input 
                        type="number" 
                        value={settings?.response_timeout || 30} 
                        onChange={(e) => updateSetting("response_timeout", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário Permitido (Início)</Label>
                      <Input 
                        type="time" 
                        value={settings?.allowed_response_start || "00:00"} 
                        onChange={(e) => updateSetting("allowed_response_start", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário Permitido (Fim)</Label>
                      <Input 
                        type="time" 
                        value={settings?.allowed_response_end || "23:59"} 
                        onChange={(e) => updateSetting("allowed_response_end", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          */}

          <TabsContent value="vars" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Variáveis Dinâmicas Disponíveis</CardTitle>
                <CardDescription>
                  Você pode usar essas tags em qualquer campo de texto para inserir dados reais no momento do envio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { tag: "{{nome}}", desc: "Nome do aluno" },
                    { tag: "{{telefone}}", desc: "Número do WhatsApp" },
                    { tag: "{{grupo}}", desc: "Nome do grupo (se houver)" },
                    { tag: "{{data}}", desc: "Data atual (ex: 18/05/2026)" },
                    { tag: "{{hora}}", desc: "Hora atual (ex: 14:30)" },
                    { tag: "{{period}}", desc: "Período do dia: morning / afternoon / evening" },
                  ].map((v) => (
                    <div key={v.tag} className="border p-4 rounded-lg bg-muted/20 flex flex-col justify-between items-start h-full">
                      <div>
                        <p className="font-mono text-primary font-bold">{v.tag}</p>
                        <p className="text-sm text-muted-foreground mt-1">{v.desc}</p>
                      </div>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="mt-4 w-full"
                        onClick={() => {
                          navigator.clipboard.writeText(v.tag);
                          toast.success(`${v.tag} copiado! Cole no campo desejado.`);
                        }}
                      >
                        Copiar Variável
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-4 border rounded-lg bg-primary/5">
                  <h4 className="font-medium mb-2">Exemplo Prático:</h4>
                  <p className="font-mono text-sm">Good {"{{period}}"}, {"{{nome}}"}! Hoje é {"{{data}}"} às {"{{hora}}"}.</p>
                  <p className="text-sm mt-2 text-muted-foreground">Como será enviado:</p>
                  <p className="font-mono text-sm bg-background p-2 rounded border mt-1">Good morning, João! Hoje é 19/05/2026 às 08:30.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
