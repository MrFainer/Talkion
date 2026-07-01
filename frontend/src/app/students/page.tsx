"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
  import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { PlusCircle, Pencil, X, Upload, Check, RefreshCw, Trash2, CalendarDays } from "lucide-react";

import { Progress } from "@/components/ui/progress";

type ImportFailure = {
  rowNumber: number;
  fullName: string;
  whatsappNumber: string;
  reason: string;
};

type ImportResult = {
  importedCount: number;
  skippedExistingCount: number;
  skippedDuplicatedInFileCount: number;
  skippedInvalidCount: number;
  totalRows: number;
  failedRows: ImportFailure[];
};

type StudentLesson = {
  id: string;
  kind: "RECURRING" | "EXTRA";
  weekday: number | null;
  date: string | null;
  time: string;
  recurring: boolean;
};

type LessonDraft =
  | { kind: "RECURRING"; weekday: number; time: string; recurring: boolean }
  | { kind: "EXTRA"; date: string; time: string };

const weekdayLabels: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

const formatLessonDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = String(value);
    return raw.includes("T") ? raw.split("T")[0] : raw;
  }
  return date.toLocaleDateString("pt-BR");
};

export default function StudentsPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentLimit, setStudentLimit] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; full_name: string } | null>(null);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ whatsappNumber: string; level: string; birthday: string } | null>(null);

  // Formulário
  const [fullName, setFullName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [englishLevel, setEnglishLevel] = useState("LEVEL_1");
  const [birthday, setBirthday] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newStudentLessons, setNewStudentLessons] = useState<LessonDraft[]>([]);
  
  // Ref para upload de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  const [lessonsDialogOpen, setLessonsDialogOpen] = useState(false);
  const [lessonsStudent, setLessonsStudent] = useState<any | null>(null);
  const [studentLessons, setStudentLessons] = useState<StudentLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [recWeekday, setRecWeekday] = useState("1");
  const [recTime, setRecTime] = useState("08:00");
  const [recRecurring, setRecRecurring] = useState(true);
  const [extraDate, setExtraDate] = useState<string>("");
  const [extraTime, setExtraTime] = useState("08:00");

  useEffect(() => {
    document.title = "Talkion - Alunos";
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchStudents = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }
    try {
      const res = await api.get(`/students/teacher/${user.id}`);
      const sorted = [...(res.data || [])].sort((a: any, b: any) =>
        String(a?.full_name || "").localeCompare(String(b?.full_name || ""), "pt-BR", {
          sensitivity: "base",
        }),
      );
      setStudents(sorted);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar alunos.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStudents();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStudents]);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/subscriptions/user/${user.id}`).then((res) => {
      const sub = res.data;
      if (sub) {
        setStudentLimit(sub.max_students + (sub.additional_students || 0));
      }
    }).catch(() => {});
  }, [user?.id]);

  const normalizeFullName = (value: string) => {
    return value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) =>
        part
          .toLowerCase()
          .split(/([-'])/)
          .map((chunk) =>
            chunk === "-" || chunk === "'"
              ? chunk
              : chunk.charAt(0).toUpperCase() + chunk.slice(1)
          )
          .join("")
      )
      .join(" ");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Limpa a formatação visual (ex: "+55 (11) 99999-9999" -> "5511999999999") antes de enviar pro backend
    const rawWhatsappNumber = whatsappNumber.replace(/\D/g, '');
    const normalizedFullName = normalizeFullName(fullName);
    
    try {
      const res = await api.post(`/students/teacher/${user?.id}`, {
        fullName: normalizedFullName,
        whatsappNumber: rawWhatsappNumber,
        englishLevel,
        birthday: birthday || null,
      });
      const createdStudentId = String(res.data?.id || "").trim();
      if (createdStudentId && newStudentLessons.length > 0) {
        await Promise.allSettled(
          newStudentLessons.map((lesson) =>
            api.post(`/lessons/student/${createdStudentId}`, lesson),
          ),
        );
      }
      toast.success("Aluno cadastrado com sucesso!");
      setIsDialogOpen(false);
      setFullName("");
      setWhatsappNumber("");
      setEnglishLevel("LEVEL_1");
      setBirthday("");
      setNewStudentLessons([]);
      fetchStudents();
    } catch (error: any) {
      const msg = error.response?.data?.message || "Erro ao cadastrar aluno.";
      if (msg.includes("limite de alunos")) {
        toast.error(msg, {
          action: {
            label: "Ver Planos",
            onClick: () => router.push("/subscriptions"),
          },
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLevelChange = async (studentId: string, newLevel: string) => {
    try {
      await api.patch(`/students/teacher/${user?.id}/${studentId}/level`, { level: newLevel });
      toast.success("Nível de inglês atualizado!");
      fetchStudents();
    } catch (error) {
      toast.error("Erro ao atualizar nível.");
    }
  };

  const handleNumberChange = async (studentId: string, newNumber: string) => {
    try {
      await api.patch(`/students/teacher/${user?.id}/${studentId}/number`, { whatsappNumber: newNumber });
      toast.success("Número do WhatsApp atualizado!");
      fetchStudents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao atualizar número.");
      throw error; // Re-throw para impedir o fechamento se houver erro
    }
  };

  const handleValidateNumber = async (studentId: string) => {
    const toastId = toast.loading("Validando número no WhatsApp...");
    try {
      const res = await api.post(`/students/teacher/${user?.id}/${studentId}/validate-number`);
      if (res.data.isValid) {
        toast.success("O número possui uma conta ativa no WhatsApp!", { id: toastId });
      } else {
        toast.error("O número NÃO possui WhatsApp ativo.", { id: toastId });
      }
      fetchStudents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao validar número.", { id: toastId });
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    setDeletingStudentId(studentId);
    try {
      await api.delete(`/students/teacher/${user?.id}/${studentId}`);
      toast.success("Aluno excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
      fetchStudents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao excluir aluno.");
    } finally {
      setDeletingStudentId(null);
    }
  };

  const fetchLessonsForStudent = useCallback(
    async (studentId: string) => {
      setLessonsLoading(true);
      try {
        const res = await api.get(`/lessons/student/${studentId}`);
        setStudentLessons((res.data || []) as StudentLesson[]);
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Erro ao carregar aulas do aluno.");
      } finally {
        setLessonsLoading(false);
      }
    },
    [],
  );

  const openLessonsForStudent = async (student: any) => {
    setLessonsStudent(student);
    setLessonsDialogOpen(true);
    await fetchLessonsForStudent(student.id);
  };

  const handleAddRecurringLessonForStudent = async () => {
    if (!lessonsStudent?.id) return;
    const weekday = Number(recWeekday);
    const time = recTime;
    try {
      await api.post(`/lessons/student/${lessonsStudent.id}`, {
        kind: "RECURRING",
        weekday,
        time,
        recurring: recRecurring,
      });
      toast.success("Aula recorrente adicionada.");
      await fetchLessonsForStudent(lessonsStudent.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao adicionar aula recorrente.");
    }
  };

  const handleAddExtraLessonForStudent = async () => {
    if (!lessonsStudent?.id) return;
    if (!extraDate) {
      toast.error("Selecione uma data para a aula extra.");
      return;
    }
    try {
      await api.post(`/lessons/student/${lessonsStudent.id}`, {
        kind: "EXTRA",
        date: extraDate,
        time: extraTime,
      });
      toast.success("Aula extra adicionada.");
      await fetchLessonsForStudent(lessonsStudent.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao adicionar aula extra.");
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!lessonId) return;
    try {
      await api.delete(`/lessons/${lessonId}`);
      toast.success("Aula removida.");
      if (lessonsStudent?.id) {
        await fetchLessonsForStudent(lessonsStudent.id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao remover aula.");
    }
  };

  const handleSaveEdits = async (studentId: string, originalNumber: string, originalLevel: string, originalBirthday: string | null) => {
    if (!editingData) return;
    
    let hasChanges = false;
    let hasError = false;

    if (editingData.whatsappNumber !== formatWhatsApp(originalNumber)) {
      try {
        const rawNumber = editingData.whatsappNumber.replace(/\D/g, '');
        await handleNumberChange(studentId, rawNumber);
        hasChanges = true;
      } catch (e) {
        hasError = true;
      }
    }

    if (editingData.level !== originalLevel) {
      await handleLevelChange(studentId, editingData.level);
      hasChanges = true;
    }

    const formattedOriginalBirthday = originalBirthday ? originalBirthday.split('T')[0] : '';
    if (editingData.birthday !== formattedOriginalBirthday) {
      try {
        await api.patch(`/students/teacher/${user?.id}/${studentId}/birthday`, {
          birthday: editingData.birthday || null,
        });
        hasChanges = true;
      } catch (e) {
        toast.error("Erro ao atualizar data de aniversário.");
        hasError = true;
      }
    }

    if (!hasChanges && !hasError) {
      toast.info("Nenhuma alteração feita.");
    }
    
    if (!hasError) {
      setEditingLevelId(null);
      setEditingData(null);
      fetchStudents();
    }
  };

  const handleCancelEdits = () => {
    setEditingLevelId(null);
    setEditingData(null);
  };

  const formatWhatsAppInput = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    
    if (cleaned.length > 13) {
      cleaned = cleaned.slice(0, 13);
    }

    if (cleaned.length === 0) {
      return '';
    } else if (cleaned.length <= 2) {
      return `+${cleaned}`;
    } else if (cleaned.length <= 4) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2)}`;
    } else if (cleaned.length <= 8) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4)}`;
    } else if (cleaned.length <= 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    } else {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
  };

  const formatWhatsApp = (phone: string) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
    } else if (cleaned.length === 12) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
    }
    return phone;
  };

  const resetImportModal = useCallback(() => {
    setSelectedImportFile(null);
    setImportProgress(0);
    setImportResult(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleImportDialogChange = useCallback((open: boolean) => {
    if (uploading) return;

    setIsImportDialogOpen(open);
    if (!open) {
      resetImportModal();
    }
  }, [resetImportModal, uploading]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (studentLimit !== null && students.length >= studentLimit) {
      toast.error("Você atingiu o limite de alunos do seu plano.", {
        action: { label: "Ver Planos", onClick: () => router.push("/subscriptions") },
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedImportFile(file);
    setImportProgress(0);
    setImportResult(null);
    setIsImportDialogOpen(true);
  };

  const handleFileUpload = async () => {
    if (!selectedImportFile) return;

    const formData = new FormData();
    formData.append("file", selectedImportFile);

    setUploading(true);
    setImportProgress(5);
    setImportResult(null);
    const toastId = toast.loading("Importando alunos...");
    try {
      const res = await api.post(`/students/teacher/${user?.id}/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setImportProgress(Math.max(10, Math.min(percent, 90)));
        },
      });
      setImportProgress(100);
      setImportResult(res.data);

      const summary = [
        `${res.data.importedCount} importado(s)`,
        res.data.skippedExistingCount ? `${res.data.skippedExistingCount} já existente(s)` : null,
        res.data.skippedDuplicatedInFileCount ? `${res.data.skippedDuplicatedInFileCount} duplicado(s) na planilha` : null,
        res.data.skippedInvalidCount ? `${res.data.skippedInvalidCount} linha(s) inválida(s)` : null,
      ].filter(Boolean);

      toast.success(summary.join(" | "), { id: toastId });
      if (res.data.importedCount > 0) {
        fetchStudents();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao importar planilha.", { id: toastId });
      setImportProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-4 pt-20 md:p-8 md:pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Alunos</h1>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelection} 
            />
            <Button 
              variant="outline" 
              className="flex items-center justify-center gap-2" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Importando..." : "Importar Excel"}
            </Button>

            <Dialog open={isImportDialogOpen} onOpenChange={handleImportDialogChange}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Importar Alunos por Excel</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium">
                      {importResult ? "Informações inseridas" : "Confirmar envio da planilha"}
                    </p>
                    {importResult ? (
                      importResult.failedRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {importResult.importedCount} aluno(s) importado(s) com sucesso.
                        </p>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {importResult.importedCount} aluno(s) importado(s) com sucesso.
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <div className="rounded-md bg-muted px-3 py-2 text-sm">
                              Importados: {importResult.importedCount}
                            </div>
                            <div className="rounded-md bg-muted px-3 py-2 text-sm">
                              Não inseridos: {importResult.failedRows.length}
                            </div>
                          </div>
                          <div className="rounded-md bg-muted px-3 py-2 text-sm">
                            {selectedImportFile?.name || "Nenhum arquivo selecionado"}
                          </div>
                        </>
                      )
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Apenas nome e WhatsApp são obrigatórios. Se o nível não vier preenchido, o aluno entra como Nível 1.
                        </p>
                        <div className="rounded-md bg-muted px-3 py-2 text-sm">
                          {selectedImportFile?.name || "Nenhum arquivo selecionado"}
                        </div>
                      </>
                    )}
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Enviando, processando planilha e validando números...</span>
                        <span>{importProgress}%</span>
                      </div>
                      <Progress value={importProgress} className="h-2" />
                    </div>
                  )}

                  {importResult && (
                    importResult.failedRows.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">Não inseridos</p>
                          <span className="text-xs text-muted-foreground">
                            {importResult.failedRows.length} caso(s)
                          </span>
                        </div>
                        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
                          {importResult.failedRows.map((failure, index) => (
                            <div key={`${failure.rowNumber}-${failure.whatsappNumber}-${index}`} className="rounded-md border bg-muted/30 p-3 text-sm">
                              <p className="font-medium">
                                Linha {failure.rowNumber}
                                {failure.fullName ? ` - ${failure.fullName}` : ""}
                              </p>
                              <p className="text-muted-foreground">
                                Número: {failure.whatsappNumber || "Não informado"}
                              </p>
                              <p className="text-muted-foreground">
                                Motivo: {failure.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  {importResult ? (
                    <Button
                      variant="outline"
                      onClick={() => handleImportDialogChange(false)}
                      disabled={uploading}
                    >
                      Fechar
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleImportDialogChange(false)}
                        disabled={uploading}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleFileUpload}
                        disabled={uploading || !selectedImportFile}
                      >
                        {uploading ? "Importando..." : "Confirmar Importação"}
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isDeleteDialogOpen}
              onOpenChange={(open) => {
                if (deletingStudentId) return;
                setIsDeleteDialogOpen(open);
                if (!open) {
                  setStudentToDelete(null);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar exclusão</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    {studentToDelete
                      ? `Deseja realmente excluir o aluno "${studentToDelete.full_name}"?`
                      : "Deseja realmente excluir este aluno?"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Essa ação remove o aluno da lista.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeleteDialogOpen(false);
                      setStudentToDelete(null);
                    }}
                    disabled={!!deletingStudentId}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (!studentToDelete) return;
                      handleDeleteStudent(studentToDelete.id, studentToDelete.full_name);
                    }}
                    disabled={!studentToDelete || !!deletingStudentId}
                  >
                    {deletingStudentId ? "Excluindo..." : "Excluir Aluno"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog 
              open={isDialogOpen} 
              onOpenChange={(open) => {
                if (open) {
                  setFullName("");
                  setWhatsappNumber("");
                  setEnglishLevel("LEVEL_1");
                  setBirthday("");
                  setNewStudentLessons([]);
                }
                setIsDialogOpen(open);
              }}
            >
              <Button
                className="flex items-center gap-2"
                onClick={() => {
                  if (studentLimit !== null && students.length >= studentLimit) {
                    toast.error("Você atingiu o limite de alunos do seu plano.", {
                      action: { label: "Ver Planos", onClick: () => router.push("/subscriptions") },
                    });
                    return;
                  }
                  setFullName("");
                  setWhatsappNumber("");
                  setEnglishLevel("LEVEL_1");
                  setBirthday("");
                  setNewStudentLessons([]);
                  setIsDialogOpen(true);
                }}
              >
                <PlusCircle className="h-4 w-4" />
                Adicionar Aluno
              </Button>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Aluno</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => setFullName((prev) => normalizeFullName(prev))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">Número do WhatsApp (com DDI e DDD)</Label>
                  <Input id="whatsapp" required placeholder="+55 (11) 99999-9999" value={whatsappNumber} onChange={(e) => setWhatsappNumber(formatWhatsAppInput(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Nível de Inglês</Label>
                  <Select value={englishLevel} onValueChange={(val) => setEnglishLevel(val || "LEVEL_1")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nível">
                        {englishLevel === 'LEVEL_1' && 'Nível 1'}
                        {englishLevel === 'LEVEL_2' && 'Nível 2'}
                        {englishLevel === 'LEVEL_3' && 'Nível 3'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEVEL_1">Nível 1</SelectItem>
                      <SelectItem value="LEVEL_2">Nível 2</SelectItem>
                      <SelectItem value="LEVEL_3">Nível 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthday">Data de Aniversário</Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                  />
                </div>
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">Aulas (opcional)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Dia da semana</Label>
                      <Select value={recWeekday} onValueChange={(val) => setRecWeekday(val || "1")}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione o dia">
                            {weekdayLabels[Number(recWeekday)] || "Selecione o dia"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(weekdayLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Input type="time" value={recTime} onChange={(e) => setRecTime(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={recRecurring} onCheckedChange={(v) => setRecRecurring(Boolean(v))} />
                      <span className="text-sm text-muted-foreground">Recorrente</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        const weekday = Number(recWeekday);
                        if (!Number.isFinite(weekday)) return;
                        setNewStudentLessons((current) => [
                          ...current,
                          { kind: "RECURRING", weekday, time: recTime, recurring: recRecurring },
                        ]);
                      }}
                    >
                      Adicionar recorrente
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Data (aula extra)</Label>
                      <Input type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Input type="time" value={extraTime} onChange={(e) => setExtraTime(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        if (!extraDate) return;
                        setNewStudentLessons((current) => [
                          ...current,
                          { kind: "EXTRA", date: extraDate, time: extraTime },
                        ]);
                      }}
                    >
                      Adicionar extra
                    </Button>
                  </div>

                  {newStudentLessons.length > 0 ? (
                    <div className="space-y-2">
                      {newStudentLessons.map((lesson, idx) => (
                        <div
                          key={`${lesson.kind}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2"
                        >
                          <div className="text-sm">
                            {lesson.kind === "RECURRING"
                              ? `Recorrente: ${weekdayLabels[(lesson as any).weekday]} às ${(lesson as any).time}`
                              : `Extra: ${(lesson as any).date} às ${(lesson as any).time}`}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setNewStudentLessons((current) => current.filter((_, i) => i !== idx))
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            </DialogContent>
            </Dialog>

            <Dialog
              open={lessonsDialogOpen}
              onOpenChange={(open) => {
                setLessonsDialogOpen(open);
                if (!open) {
                  setLessonsStudent(null);
                  setStudentLessons([]);
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {lessonsStudent?.full_name ? `Aulas - ${lessonsStudent.full_name}` : "Aulas"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">Adicionar recorrente</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Dia da semana</Label>
                        <Select value={recWeekday} onValueChange={(val) => setRecWeekday(val || "1")}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione o dia">
                              {weekdayLabels[Number(recWeekday)] || "Selecione o dia"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(weekdayLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Horário</Label>
                        <Input type="time" value={recTime} onChange={(e) => setRecTime(e.target.value)} className="h-9" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={recRecurring} onCheckedChange={(v) => setRecRecurring(Boolean(v))} />
                        <span className="text-sm text-muted-foreground">Recorrente</span>
                      </div>
                      <Button type="button" onClick={handleAddRecurringLessonForStudent} className="h-9">
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">Adicionar extra (data específica)</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Data</Label>
                        <Input type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-2">
                        <Label>Horário</Label>
                        <Input type="time" value={extraTime} onChange={(e) => setExtraTime(e.target.value)} className="h-9" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" onClick={handleAddExtraLessonForStudent} className="h-9">
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Aulas cadastradas</p>
                    {lessonsLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : studentLessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma aula cadastrada.</p>
                    ) : (
                      <div className="space-y-2">
                        {studentLessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                            <div className="text-sm">
                              {lesson.kind === "EXTRA"
                                ? `Extra: ${formatLessonDate(lesson.date)} às ${lesson.time}`
                                : `Recorrente: ${weekdayLabels[lesson.weekday ?? 0]} às ${lesson.time}`}
                              {!lesson.recurring && lesson.kind === "RECURRING" ? " (desativada)" : ""}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Alunos — {students.length} {students.length === 1 ? "aluno" : "alunos"}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Carregando...</p>
            ) : students.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum aluno cadastrado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Aniversário</TableHead>
                    <TableHead>Recebeu hoje?</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell>
                        {editingLevelId === student.id ? (
                          <Input 
                            value={editingData?.whatsappNumber || ""} 
                            onChange={(e) => setEditingData(prev => ({ ...prev!, whatsappNumber: formatWhatsAppInput(e.target.value) }))}
                            className="w-[160px] h-8 text-xs"
                            placeholder="+55 (11) 99999-9999"
                          />
                        ) : (
                          formatWhatsApp(student.whatsapp_number)
                        )}
                      </TableCell>
                      <TableCell>
                        {editingLevelId === student.id ? (
                          <Select 
                            value={editingData?.level || student.english_level} 
                            onValueChange={(value) => {
                              if (value) setEditingData(prev => ({ ...prev!, level: value }));
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue>
                                {(editingData?.level || student.english_level) === 'LEVEL_1' && 'Nível 1'}
                                {(editingData?.level || student.english_level) === 'LEVEL_2' && 'Nível 2'}
                                {(editingData?.level || student.english_level) === 'LEVEL_3' && 'Nível 3'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LEVEL_1">Nível 1</SelectItem>
                              <SelectItem value="LEVEL_2">Nível 2</SelectItem>
                              <SelectItem value="LEVEL_3">Nível 3</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">
                            {student.english_level === 'LEVEL_1' && 'Nível 1'}
                            {student.english_level === 'LEVEL_2' && 'Nível 2'}
                            {student.english_level === 'LEVEL_3' && 'Nível 3'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingLevelId === student.id ? (
                          <Input 
                            type="date"
                            value={editingData?.birthday || ""} 
                            onChange={(e) => setEditingData(prev => ({ ...prev!, birthday: e.target.value }))}
                            className="w-[140px] h-8 text-xs"
                          />
                        ) : (
                          <span className="text-sm">
                            {student.birthday
                              ? new Date(student.birthday).toLocaleDateString("pt-BR")
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            student.received_news_today ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {student.received_news_today ? "Sim" : "Não"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openLessonsForStudent(student)}
                              >
                                <CalendarDays className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <TooltipContent>
                            <p>Aulas</p>
                          </TooltipContent>
                        </Tooltip>
                        {editingLevelId === student.id ? (
                          <>
                            <Tooltip>
                              <TooltipTrigger render={
                                <Button 
                                  variant="ghost" 
                                  size="icon-sm"
                                  onClick={handleCancelEdits}
                                  className="text-muted-foreground"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              } />
                              <TooltipContent>
                                <p>Cancelar Edição</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger render={
                                <Button 
                                  variant="ghost" 
                                  size="icon-sm"
                                  onClick={() => handleSaveEdits(student.id, student.whatsapp_number, student.english_level, student.birthday)}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              } />
                              <TooltipContent>
                                <p>Salvar Alterações</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button 
                                variant="ghost" 
                                size="icon-sm"
                                onClick={() => {
                                  setEditingLevelId(student.id);
                                  setEditingData({ 
                                    whatsappNumber: formatWhatsApp(student.whatsapp_number), 
                                    level: student.english_level,
                                    birthday: student.birthday ? student.birthday.split('T')[0] : "",
                                  });
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            } />
                            <TooltipContent>
                              <p>Editar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setStudentToDelete({
                                  id: student.id,
                                  full_name: student.full_name,
                                });
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-red-500 hover:text-red-600"
                              disabled={deletingStudentId === student.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          } />
                          <TooltipContent>
                            <p>Excluir Aluno</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
                </div>
              )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
