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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { PlusCircle, Power, PowerOff, Pencil, X, Upload, Check, RefreshCw, Trash2 } from "lucide-react";

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

export default function StudentsPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; full_name: string } | null>(null);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ whatsappNumber: string, level: string, receivePrivateNews: boolean } | null>(null);

  // Formulário
  const [fullName, setFullName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [englishLevel, setEnglishLevel] = useState("LEVEL_1");
  const [receivePrivateNews, setReceivePrivateNews] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Ref para upload de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

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
      await api.post(`/students/teacher/${user?.id}`, {
        fullName: normalizedFullName,
        whatsappNumber: rawWhatsappNumber,
        englishLevel,
        receivePrivateNews
      });
      toast.success("Aluno cadastrado com sucesso!");
      setIsDialogOpen(false);
      setFullName("");
      setWhatsappNumber("");
      setEnglishLevel("LEVEL_1");
      setReceivePrivateNews(false);
      fetchStudents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao cadastrar aluno.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (studentId: string) => {
    try {
      await api.patch(`/students/teacher/${user?.id}/${studentId}/toggle`);
      toast.success("Status atualizado!");
      fetchStudents();
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleTogglePrivateNews = async (studentId: string, currentVal: boolean) => {
    try {
      await api.patch(`/students/teacher/${user?.id}/${studentId}/toggle-private`);
      toast.success("Configuração de mensagem privada atualizada!");
      fetchStudents();
    } catch (error) {
      toast.error("Erro ao atualizar configuração.");
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

  const handleSaveEdits = async (studentId: string, originalNumber: string, originalLevel: string, originalPrivate: boolean) => {
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

    if (editingData.receivePrivateNews !== originalPrivate) {
      await handleTogglePrivateNews(studentId, editingData.receivePrivateNews);
      hasChanges = true;
    }

    if (!hasChanges && !hasError) {
      toast.info("Nenhuma alteração feita.");
    }
    
    if (!hasError) {
      setEditingLevelId(null);
      setEditingData(null);
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
      <main className="flex-1 min-w-0 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Alunos</h1>
          
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelection} 
            />
            <Button 
              variant="outline" 
              className="flex items-center gap-2" 
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
                  setReceivePrivateNews(false);
                }
                setIsDialogOpen(open);
              }}
            >
              <DialogTrigger render={<Button className="flex items-center gap-2" />}>
                <PlusCircle className="h-4 w-4" />
                Adicionar Aluno
              </DialogTrigger>
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
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="private-news"
                    checked={receivePrivateNews}
                    onChange={(e) => setReceivePrivateNews(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="private-news" className="cursor-pointer">Receber Notícias no Privado?</Label>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Alunos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Carregando...</p>
            ) : students.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum aluno cadastrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Privado?</TableHead>
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
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {student.active ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {editingLevelId === student.id ? (
                          <Tooltip>
                            <TooltipTrigger render={
                              <button 
                                onClick={() => setEditingData(prev => ({ ...prev!, receivePrivateNews: !prev!.receivePrivateNews }))}
                                className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${editingData?.receivePrivateNews ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                              >
                                {editingData?.receivePrivateNews ? "Sim" : "Não"}
                              </button>
                            } />
                            <TooltipContent>
                              <p>Clique para alterar</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.receive_private_news ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {student.receive_private_news ? "Sim" : "Não"}
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
                                  onClick={() => handleSaveEdits(student.id, student.whatsapp_number, student.english_level, student.receive_private_news)}
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
                                    receivePrivateNews: student.receive_private_news 
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
                              onClick={() => handleToggleStatus(student.id)}
                              className={student.active ? "text-red-500" : "text-green-500"}
                            >
                              {student.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                          } />
                          <TooltipContent>
                            <p>{student.active ? "Inativar Aluno" : "Ativar Aluno"}</p>
                          </TooltipContent>
                        </Tooltip>
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
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
