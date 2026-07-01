"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Sparkles,
  TrendingUp,
  BookOpen,
  Lightbulb,
  HelpCircle,
  Newspaper,
  Star,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  Heart,
  HeartOff,
  Archive,
  Eye,
  Edit3,
  RotateCcw,
  Save,
  Filter,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
type ContentType = "VOCABULARY" | "TIPS" | "QUIZ" | "INFORMATIVE" | "CURIOSITY";
type TrendItem = { title: string; area: string };

type CarouselSlide = { title: string; body: string; vocabulary?: string };
type QuizQuestion = { question: string; options: string[]; correctAnswer: string };

type GenerationResult = {
  singlePost: string;
  carousel: CarouselSlide[];
  description: string;
  quizQuestions: QuizQuestion[];
  promptUsed: string;
  aiModel: string;
};

type ContentItem = {
  id: string;
  teacher_id: string;
  title: string;
  type: ContentType;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  trend_topic: string | null;
  trend_area: string | null;
  single_post: string | null;
  carousel: CarouselSlide[];
  description: string | null;
  quiz_questions: QuizQuestion[] | null;
  tags: string[];
  favorite: boolean;
  source: string;
  version: number;
  created_at: string;
  updated_at: string;
};

// ─── Constants ───────────────────────────────────────────
const CONTENT_TYPES: { value: ContentType; label: string; icon: any }[] = [
  { value: "VOCABULARY", label: "Vocabulário", icon: BookOpen },
  { value: "TIPS", label: "Dicas", icon: Lightbulb },
  { value: "QUIZ", label: "Quiz", icon: HelpCircle },
  { value: "INFORMATIVE", label: "Informativo", icon: Newspaper },
  { value: "CURIOSITY", label: "Curiosidade", icon: Star },
];

const TONES = [
  { value: "formal", label: "Formal" },
  { value: "informal", label: "Informal" },
  { value: "motivational", label: "Motivacional" },
  { value: "fun", label: "Divertido" },
];

const LEVELS = [
  { value: "beginner", label: "Iniciante" },
  { value: "intermediate", label: "Intermediário" },
  { value: "advanced", label: "Avançado" },
];

const PLATFORMS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
];

const AREA_LABELS: Record<string, string> = {
  education: "Educação",
  business: "Negócios",
  technology: "Tecnologia",
  health: "Saúde",
  entertainment: "Entretenimento",
};

const AUTOSAVE_KEY = "talkion_content_draft";
const AUTOSAVE_INTERVAL = 30000;

// ─── Component ───────────────────────────────────────────
export default function ContentStudioPage() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const [activeTab, setActiveTab] = useState("create");
  const [contentEnabled, setContentEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.title = "Talkion - Estúdio de Conteúdo";
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/message-settings/${user.id}`)
      .then((res) => setContentEnabled(res.data?.admin_content_generation_enabled !== false))
      .catch(() => setContentEnabled(true));
  }, [user?.id]);

  if (!isHydrated || !user) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (contentEnabled === false) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <div className="text-center max-w-md space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <FileText className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold">Conteúdo desativado</h2>
            <p className="text-muted-foreground">
              A geração de conteúdo está desativada para sua conta.
              Entre em contato com o administrador do Talkion para mais informações.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-4 pt-20 md:p-8 md:pt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Estúdio de Conteúdo</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Criar Conteúdo</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Biblioteca</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <CreateTab teacherId={user.id} />
          </TabsContent>

          <TabsContent value="library" className="space-y-6">
            <LibraryTab teacherId={user.id} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

// ─── Create Tab ──────────────────────────────────────────
function CreateTab({ teacherId }: { teacherId: string }) {
  // Trends
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedGeo, setSelectedGeo] = useState("BR");
  const [geoOptions, setGeoOptions] = useState<{ code: string; name: string }[]>([]);
  const [topicSource, setTopicSource] = useState<"trends" | "ai" | "manual">("trends");
  const [aiTopics, setAiTopics] = useState<string[]>([]);
  const [aiTopicsLoading, setAiTopicsLoading] = useState(false);
  const [customTopic, setCustomTopic] = useState("");

  // Form
  const [selectedType, setSelectedType] = useState<ContentType>("VOCABULARY");
  const [selectedTone, setSelectedTone] = useState("informal");
  const [selectedLevel, setSelectedLevel] = useState("beginner");
  const [selectedPlatform, setSelectedPlatform] = useState("whatsapp");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Carousel navigation
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dialogs
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<GenerationResult | null>(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);

  // Autosave
  const draftRef = useRef(result);

  // Fetch trends
  const fetchTrends = useCallback(async (area?: string, geo?: string) => {
    setTrendsLoading(true);
    setTrendsError(false);
    try {
      const params = new URLSearchParams();
      if (area && area !== "all") params.set("area", area);
      if (geo) params.set("geo", geo);
      const qs = params.toString();
      const res = await api.get(`/trends/trending${qs ? `?${qs}` : ""}`);
      setTrends(res.data || []);
    } catch {
      setTrendsError(true);
      setTrends([]);
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (topicSource === "trends") {
      fetchTrends(selectedArea, selectedGeo);
    }
  }, [selectedArea, selectedGeo, topicSource, fetchTrends]);

  // Autosave
  useEffect(() => {
    draftRef.current = result;
  }, [result]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (draftRef.current) {
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draftRef.current));
        } catch {}
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Restore draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GenerationResult;
        if (parsed.singlePost || parsed.description || parsed.carousel?.length > 0) {
          setPendingDraft(parsed);
          setDraftDialogOpen(true);
        }
      }
    } catch {}
  }, []);

  // Handle topic click
  const handleTopicClick = (topic: string) => {
    setCustomTopic(topic);
  };

  // Generate
  const doGenerate = async (topic: string) => {
    setGenerating(true);
    const toastId = toast.loading("Gerando conteúdo...");

    try {
      const res = await api.post("/content/generate", {
        teacherId,
        topic,
        type: selectedType,
        tone: selectedTone,
        level: selectedLevel,
        platform: selectedPlatform,
      });

      setResult(res.data);
      setCurrentSlide(0);
      toast.success("Conteúdo gerado com sucesso!", { id: toastId });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao gerar conteúdo", {
        id: toastId,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    const topic = customTopic.trim();
    if (!topic) {
      toast.error("Digite ou selecione um tópico");
      return;
    }

    if (result) {
      setRegenerateDialogOpen(true);
      return;
    }

    doGenerate(topic);
  };

  const confirmRegenerate = () => {
    setRegenerateDialogOpen(false);
    doGenerate(customTopic.trim());
  };

  // Save
  const handleSave = async () => {
    if (!result) return;

    setSaving(true);
    const toastId = toast.loading("Salvando conteúdo...");

    try {
      await api.post("/content", {
        teacherId,
        title: customTopic.trim() || "Conteúdo sem título",
        type: selectedType,
        singlePost: result.singlePost,
        carousel: result.carousel,
        description: result.description,
        quizQuestions: result.quizQuestions,
        promptUsed: result.promptUsed,
        aiModel: result.aiModel,
        trendTopic: customTopic.trim() || undefined,
        source: "trend",
        tags: [selectedType.toLowerCase()],
      });

      localStorage.removeItem(AUTOSAVE_KEY);
      toast.success("Conteúdo salvo na biblioteca!", { id: toastId });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao salvar", {
        id: toastId,
      });
    } finally {
      setSaving(false);
    }
  };

  // Update carousel slide
  const updateSlide = (index: number, field: keyof CarouselSlide, value: string) => {
    if (!result) return;
    const newCarousel = [...result.carousel];
    newCarousel[index] = { ...newCarousel[index], [field]: value };
    setResult({ ...result, carousel: newCarousel });
  };

  // Add slide
  const addSlide = () => {
    if (!result) return;
    setResult({
      ...result,
      carousel: [...result.carousel, { title: "", body: "" }],
    });
  };

  // Update single post
  const updateSinglePost = (value: string) => {
    if (!result) return;
    setResult({ ...result, singlePost: value });
  };

  // Update description
  const updateDescription = (value: string) => {
    if (!result) return;
    setResult({ ...result, description: value });
  };

  // Update quiz question
  const updateQuizQuestion = (index: number, field: string, value: string) => {
    if (!result || !result.quizQuestions) return;
    const newQuestions = [...result.quizQuestions];
    if (field === "question") {
      newQuestions[index] = { ...newQuestions[index], question: value };
    } else if (field.startsWith("option_")) {
      const optIndex = parseInt(field.replace("option_", ""));
      const options = [...newQuestions[index].options];
      options[optIndex] = value;
      newQuestions[index] = { ...newQuestions[index], options };
    } else if (field === "correctAnswer") {
      newQuestions[index] = { ...newQuestions[index], correctAnswer: value };
    }
    setResult({ ...result, quizQuestions: newQuestions });
  };

  const addQuizQuestion = () => {
    if (!result) return;
    const questions = result.quizQuestions || [];
    setResult({
      ...result,
      quizQuestions: [
        ...questions,
        { question: "", options: ["", "", ""], correctAnswer: "A" },
      ],
    });
  };

  // Load geo options
  useEffect(() => {
    api.get("/trends/geo-options").then((res) => {
      if (res.data) setGeoOptions(res.data);
    }).catch(() => {});
  }, []);

  // Generate AI topics
  const handleGenerateAiTopics = async () => {
    setAiTopicsLoading(true);
    const toastId = toast.loading("Gerando sugestões de tópicos...");
    try {
      const category = selectedArea === "all" ? undefined : AREA_LABELS[selectedArea];
      const res = await api.post("/trends/ai-topics", { teacherId, count: 12, category });
      setAiTopics(res.data || []);
      toast.success("Sugestões geradas!", { id: toastId });
    } catch {
      toast.error("Erro ao gerar sugestões", { id: toastId });
    } finally {
      setAiTopicsLoading(false);
    }
  };

  const areaList = ["all", ...Object.keys(AREA_LABELS)];

  return (
    <div className="space-y-6">
      {/* Step 1: Topic */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            1. Escolha o Tópico
          </CardTitle>
          <CardDescription>
            Selecione uma tendência, gere ideias com IA, ou digite um tópico personalizado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source selector */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <Button
              variant={topicSource === "trends" ? "default" : "outline"}
              size="sm"
              onClick={() => setTopicSource("trends")}
              className="flex items-center gap-1.5"
            >
              <TrendingUp className="h-4 w-4" />
              Tendências
            </Button>
            <Button
              variant={topicSource === "ai" ? "default" : "outline"}
              size="sm"
              onClick={() => setTopicSource("ai")}
              className="flex items-center gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              Gerar com IA
            </Button>
            <Button
              variant={topicSource === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setTopicSource("manual")}
              className="flex items-center gap-1.5"
            >
              <FileText className="h-4 w-4" />
              Personalizado
            </Button>
          </div>

          {/* Source: Google Trends */}
          {topicSource === "trends" && (
            <div className="space-y-3">
              {/* Region selector */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">País:</span>
                {geoOptions.map((g) => (
                  <Button
                    key={g.code}
                    variant={selectedGeo === g.code ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedGeo(g.code)}
                  >
                    {g.name}
                  </Button>
                ))}
              </div>

              {/* Trends list */}
              {trendsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando tendências...
                </div>
              ) : trendsError ? (
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar tendências. Tente outra região ou use outra fonte.
                </p>
              ) : trends.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tendência encontrada para esta área. Tente &ldquo;Todas&rdquo; ou outra região.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trends.map((trend, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className={`${customTopic === trend.title ? "ring-2 ring-primary" : ""}`}
                      onClick={() => handleTopicClick(trend.title)}
                    >
                      {trend.title}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Source: AI Generated */}
          {topicSource === "ai" && (
            <div className="space-y-3">
              {/* Category filter for AI */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Categoria:</span>
                {areaList.map((area) => (
                  <Button
                    key={area}
                    variant={selectedArea === area ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedArea(area)}
                  >
                    {area === "all" ? "🌎 Conhecimentos Gerais" : AREA_LABELS[area] || area}
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  A IA sugere tópicos relevantes para criar conteúdo de inglês.
                </p>
                <Button
                  onClick={handleGenerateAiTopics}
                  disabled={aiTopicsLoading}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {aiTopicsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {aiTopics.length > 0 ? "Regenerar" : "Gerar ideias"}
                </Button>
              </div>

              {aiTopicsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando sugestões...
                </div>
              ) : aiTopics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {aiTopics.map((topic, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className={`${customTopic === topic ? "ring-2 ring-primary" : ""}`}
                      onClick={() => handleTopicClick(topic)}
                    >
                      {topic}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  <p>Escolha uma categoria e clique em &ldquo;Gerar ideias&rdquo;</p>
                </div>
              )}
            </div>
          )}

          {/* Source: Custom */}
          {topicSource === "manual" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Digite qualquer tópico para criar conteúdo personalizado.
              </p>
              <Input
                placeholder="Digite um tópico personalizado..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="w-full"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            2. Tipo de Conteúdo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((ct) => {
              const Icon = ct.icon;
              return (
                <Button
                  key={ct.value}
                  variant={selectedType === ct.value ? "default" : "outline"}
                  onClick={() => setSelectedType(ct.value)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {ct.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Adjustments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-5 w-5 text-primary" />
            3. Ajustes (opcional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tom</Label>
              <div className="flex flex-wrap gap-1">
                {TONES.map((t) => (
                  <Button
                    key={t.value}
                    variant={selectedTone === t.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTone(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <div className="flex flex-wrap gap-1">
                {LEVELS.map((l) => (
                  <Button
                    key={l.value}
                    variant={selectedLevel === l.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedLevel(l.value)}
                  >
                    {l.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rede</Label>
              <div className="flex flex-wrap gap-1">
                {PLATFORMS.map((p) => (
                  <Button
                    key={p.value}
                    variant={selectedPlatform === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPlatform(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generating || !customTopic.trim()}
        className="gap-2"
      >
        {generating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Gerar Conteúdo
          </>
        )}
      </Button>

      {/* Result */}
      {result && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Single Post */}
            <div className="space-y-2">
              <Label>✏️ Single Post (editável)</Label>
              <Textarea
                value={result.singlePost}
                onChange={(e) => updateSinglePost(e.target.value)}
                className="min-h-[150px]"
              />
            </div>

            {/* Carousel — todos os slides visíveis */}
            {result.carousel.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>🎠 Carrossel ({result.carousel.length} slides)</Label>
                  <Button variant="outline" size="sm" onClick={addSlide}>
                    <Plus className="h-4 w-4" />
                    Add slide
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {result.carousel.map((slide, idx) => (
                    <Card key={idx} className="border-dashed">
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Slide {idx + 1}
                          </span>
                        </div>
                        <Input
                          placeholder="Título do slide"
                          value={slide.title || ""}
                          onChange={(e) =>
                            updateSlide(idx, "title", e.target.value)
                          }
                        />
                        <Textarea
                          placeholder="Conteúdo do slide"
                          value={slide.body || ""}
                          onChange={(e) =>
                            updateSlide(idx, "body", e.target.value)
                          }
                          className="min-h-[80px]"
                        />
                        <Input
                          placeholder="Vocabulário (opcional)"
                          value={slide.vocabulary || ""}
                          onChange={(e) =>
                            updateSlide(idx, "vocabulary", e.target.value)
                          }
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>📋 Descrição (editável)</Label>
              <Textarea
                value={result.description}
                onChange={(e) => updateDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Quiz Questions */}
            {result.quizQuestions && result.quizQuestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>❓ Quiz</Label>
                  <Button variant="outline" size="sm" onClick={addQuizQuestion}>
                    <Plus className="h-4 w-4" />
                    Add pergunta
                  </Button>
                </div>

                {result.quizQuestions.map((q, qi) => (
                  <Card key={qi} className="border-dashed">
                    <CardContent className="space-y-3 pt-4">
                      <Input
                        placeholder={`Pergunta ${qi + 1}`}
                        value={q.question}
                        onChange={(e) =>
                          updateQuizQuestion(qi, "question", e.target.value)
                        }
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        {q.options.map((opt, oi) => (
                          <Input
                            key={oi}
                            placeholder={`${String.fromCharCode(65 + oi)})`}
                            value={opt}
                            onChange={(e) =>
                              updateQuizQuestion(
                                qi,
                                `option_${oi}`,
                                e.target.value
                              )
                            }
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground font-normal">
                          Correta:
                        </Label>
                        <Select
                          value={q.correctAnswer}
                          onValueChange={(value) =>
                            updateQuizQuestion(qi, "correctAnswer", value ?? "A")
                          }
                        >
                          <SelectTrigger className="w-20 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {q.options.map((_, oi) => (
                              <SelectItem key={oi} value={String.fromCharCode(65 + oi)}>
                                {String.fromCharCode(65 + oi)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Regenerar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar na Biblioteca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rascunho encontrado</DialogTitle>
            <DialogDescription>
              Você tem um rascunho não salvo. Deseja restaurá-lo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDraftDialogOpen(false); localStorage.removeItem(AUTOSAVE_KEY); }}>
              Descartar
            </Button>
            <Button onClick={() => { setDraftDialogOpen(false); if (pendingDraft) setResult(pendingDraft); }}>
              Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar conteúdo</DialogTitle>
            <DialogDescription>
              Isso substituirá o conteúdo atual. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmRegenerate}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Library Tab ─────────────────────────────────────────
function LibraryTab({ teacherId }: { teacherId: string }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState("recent");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, page: String(page), limit: "20", sort });
      if (search) params.set("search", search);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (favoritesOnly) params.set("favorite", "true");

      const res = await api.get(`/content?${params}`);
      setItems(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      toast.error("Erro ao carregar biblioteca");
    } finally {
      setLoading(false);
    }
  }, [teacherId, page, sort, search, typeFilter, favoritesOnly]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    try {
      await api.patch(`/content/${id}/favorite`, { teacherId });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, favorite: !item.favorite } : item
        )
      );
    } catch {
      toast.error("Erro ao atualizar favorito");
    }
  };

  // Soft delete
  const handleDelete = (id: string) => {
    setArchiveId(id);
    setArchiveDialogOpen(true);
  };

  const confirmArchive = async () => {
    if (!archiveId) return;
    setArchiveDialogOpen(false);
    try {
      await api.delete(`/content/${archiveId}`, { data: { teacherId } });
      setItems((prev) => prev.filter((item) => item.id !== archiveId));
      toast.success("Conteúdo arquivado");
    } catch {
      toast.error("Erro ao arquivar");
    }
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await api.patch(`/content/${editingItem.id}`, {
        teacherId,
        title: editingItem.title,
        singlePost: editingItem.single_post,
        carousel: editingItem.carousel,
        description: editingItem.description,
        tags: editingItem.tags,
      });
      toast.success("Conteúdo atualizado");
      setEditingItem(null);
      fetchLibrary();
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const typeLabel = (type: ContentType) =>
    CONTENT_TYPES.find((ct) => ct.value === type)?.label || type;

  if (editingItem) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setEditingItem(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Editando: {editingItem.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editingItem.title}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Single Post</Label>
              <Textarea
                value={editingItem.single_post || ""}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, single_post: e.target.value })
                }
                className="min-h-[150px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editingItem.description || ""}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, description: e.target.value })
                }
              />
            </div>
            <Button onClick={handleSaveEdit} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button
          variant={favoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className="gap-2"
        >
          <Heart className={`h-4 w-4 ${favoritesOnly ? "fill-current" : ""}`} />
          Favoritos
        </Button>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1">
        {["all", ...CONTENT_TYPES.map((ct) => ct.value)].map((t) => (
          <Button
            key={t}
            variant={typeFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTypeFilter(t);
              setPage(1);
            }}
          >
            {t === "all" ? "Todos" : typeLabel(t as ContentType)}
          </Button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Ordenar:</span>
        {[
          { value: "recent", label: "Recentes" },
          { value: "favorite", label: "Favoritos" },
          { value: "type", label: "Tipo" },
        ].map((s) => (
          <Button
            key={s.value}
            variant={sort === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSort(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Content list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-lg font-medium">Biblioteca vazia</p>
          <p className="text-sm">Gere e salve conteúdos para vê-los aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.favorite && (
                      <Heart className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
                    )}
                    <h3 className="font-medium truncate">{item.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                      {typeLabel(item.type)}
                    </span>
                    {item.trend_topic && (
                      <span>🔥 {item.trend_topic}</span>
                    )}
                    <span>
                      {item.carousel?.length || 0} formatos
                    </span>
                    {item.tags?.length > 0 && item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-muted-foreground/60">
                        #{tag}
                      </span>
                    ))}
                    <span className="text-muted-foreground/40">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleFavorite(item.id)}
                    title={item.favorite ? "Remover favorito" : "Favoritar"}
                  >
                    {item.favorite ? (
                      <HeartOff className="h-4 w-4" />
                    ) : (
                      <Heart className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingItem(item)}
                    title="Editar"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    title="Arquivar"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Próxima
          </Button>
        </div>
      )}

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar conteúdo</DialogTitle>
            <DialogDescription>
              Deseja arquivar este conteúdo? Ele poderá ser restaurado depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmArchive}>
              Arquivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
