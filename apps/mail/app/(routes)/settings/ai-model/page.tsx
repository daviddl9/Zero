import {
  type AIProvider,
  PROVIDERS,
  getModelsForProvider,
  getDefaultModel,
  SERVER_DEFAULTS,
} from '@/lib/ai-models';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SettingsCard } from '@/components/settings/settings-card';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { useTRPC } from '@/providers/query-provider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';
import { toast } from 'sonner';

interface AIModelFormValues {
  provider: AIProvider | 'server-default';
  defaultModel: string;
  summarizationModel: string;
}

export default function AIModelPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [validatingOpenai, setValidatingOpenai] = useState(false);
  const [validatingGemini, setValidatingGemini] = useState(false);
  const [openaiValid, setOpenaiValid] = useState<boolean | null>(null);
  const [geminiValid, setGeminiValid] = useState<boolean | null>(null);

  const trpc = useTRPC();

  const { data: aiSettings, refetch: refetchSettings } = useQuery(
    trpc.aiSettings.get.queryOptions(),
  );

  const { mutateAsync: setProvider } = useMutation(trpc.aiSettings.setProvider.mutationOptions());
  const { mutateAsync: setApiKey } = useMutation(trpc.aiSettings.setApiKey.mutationOptions());
  const { mutateAsync: clearApiKey } = useMutation(trpc.aiSettings.clearApiKey.mutationOptions());
  const { mutateAsync: setModels } = useMutation(trpc.aiSettings.setModels.mutationOptions());
  const { mutateAsync: validateKey } = useMutation(trpc.aiSettings.validateKey.mutationOptions());

  const form = useForm<AIModelFormValues>({
    defaultValues: {
      provider: 'server-default',
      defaultModel: SERVER_DEFAULTS.compositionModel,
      summarizationModel: SERVER_DEFAULTS.summarizationModel,
    },
  });

  const selectedProvider = form.watch('provider');
  const actualProvider: AIProvider | null =
    selectedProvider === 'server-default' ? null : selectedProvider;

  // Get available models based on selected provider
  const compositionModels = actualProvider
    ? getModelsForProvider(actualProvider, 'composition')
    : getModelsForProvider('gemini', 'composition');

  const summarizationModels = actualProvider
    ? getModelsForProvider(actualProvider, 'summarization')
    : getModelsForProvider('gemini', 'summarization');

  // Update form when settings load
  useEffect(() => {
    if (aiSettings) {
      const provider = aiSettings.aiProvider || 'server-default';
      form.reset({
        provider: provider as AIProvider | 'server-default',
        defaultModel:
          aiSettings.defaultModel || getDefaultModel(aiSettings.aiProvider, 'composition'),
        summarizationModel:
          aiSettings.summarizationModel || getDefaultModel(aiSettings.aiProvider, 'summarization'),
      });
    }
  }, [aiSettings, form]);

  // Update models when provider changes
  useEffect(() => {
    const provider = actualProvider;
    form.setValue('defaultModel', getDefaultModel(provider, 'composition'));
    form.setValue('summarizationModel', getDefaultModel(provider, 'summarization'));
  }, [actualProvider, form]);

  async function handleValidateKey(provider: AIProvider) {
    const key = provider === 'openai' ? openaiKey : geminiKey;
    if (!key) return;

    if (provider === 'openai') {
      setValidatingOpenai(true);
      setOpenaiValid(null);
    } else {
      setValidatingGemini(true);
      setGeminiValid(null);
    }

    try {
      const result = await validateKey({ provider, apiKey: key });
      if (provider === 'openai') {
        setOpenaiValid(result.valid);
      } else {
        setGeminiValid(result.valid);
      }

      if (!result.valid) {
        toast.error(result.error || m['pages.settings.aiModel.invalidApiKey']());
      }
    } catch {
      if (provider === 'openai') {
        setOpenaiValid(false);
      } else {
        setGeminiValid(false);
      }
      toast.error(m['pages.settings.aiModel.validationFailed']());
    } finally {
      if (provider === 'openai') {
        setValidatingOpenai(false);
      } else {
        setValidatingGemini(false);
      }
    }
  }

  async function handleSaveKey(provider: AIProvider) {
    const key = provider === 'openai' ? openaiKey : geminiKey;
    if (!key) return;

    try {
      await setApiKey({ provider, apiKey: key });
      await refetchSettings();
      toast.success(m['pages.settings.aiModel.keySaved']());

      // Clear the input after successful save
      if (provider === 'openai') {
        setOpenaiKey('');
        setOpenaiValid(null);
      } else {
        setGeminiKey('');
        setGeminiValid(null);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : m['pages.settings.aiModel.keySaveFailed'](),
      );
    }
  }

  async function handleClearKey(provider: AIProvider) {
    try {
      await clearApiKey({ provider });
      await refetchSettings();
      toast.success(m['pages.settings.aiModel.keyCleared']());
    } catch {
      toast.error(m['pages.settings.aiModel.keyClearFailed']());
    }
  }

  async function onSubmit(values: AIModelFormValues) {
    setIsSaving(true);

    try {
      // Save provider preference
      await setProvider({
        provider: values.provider === 'server-default' ? null : values.provider,
      });

      // Save model preferences
      await setModels({
        defaultModel: values.defaultModel,
        summarizationModel: values.summarizationModel,
      });

      await refetchSettings();
      toast.success(m['common.settings.saved']());
    } catch (error) {
      console.error(error);
      toast.error(m['common.settings.failedToSave']());
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={m['pages.settings.aiModel.title']()}
        description={m['pages.settings.aiModel.description']()}
        footer={
          <Button type="submit" form="ai-model-form" disabled={isSaving}>
            {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
          </Button>
        }
      >
        <Form {...form}>
          <form id="ai-model-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Provider Selection */}
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{m['pages.settings.aiModel.providerLabel']()}</FormLabel>
                  <FormDescription>
                    {m['pages.settings.aiModel.providerDescription']()}
                  </FormDescription>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <RadioGroupItem value="server-default" id="server-default" />
                        <Label htmlFor="server-default" className="flex-1 cursor-pointer">
                          <div className="font-medium">
                            {m['pages.settings.aiModel.serverDefault']()}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {m['pages.settings.aiModel.serverDefaultDescription']()}
                          </div>
                        </Label>
                      </div>
                      {PROVIDERS.map((provider) => (
                        <div
                          key={provider.id}
                          className="flex items-center space-x-3 rounded-lg border p-3"
                        >
                          <RadioGroupItem value={provider.id} id={provider.id} />
                          <Label htmlFor={provider.id} className="flex-1 cursor-pointer">
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-muted-foreground text-sm">
                              {provider.description}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* API Key Section - Only show when a provider is selected */}
            {actualProvider && (
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-medium">{m['pages.settings.aiModel.apiKeysTitle']()}</h3>

                {/* OpenAI Key */}
                {actualProvider === 'openai' && (
                  <div className="space-y-2">
                    <Label>{m['pages.settings.aiModel.openaiKey']()}</Label>
                    {aiSettings?.hasOpenaiKey ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-muted flex h-9 flex-1 items-center rounded-md px-3 text-sm">
                          <Check className="mr-2 h-4 w-4 text-green-500" />
                          {m['pages.settings.aiModel.keyStored']()}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearKey('openai')}
                        >
                          {m['pages.settings.aiModel.clearKey']()}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showOpenaiKey ? 'text' : 'password'}
                            value={openaiKey}
                            onChange={(e) => {
                              setOpenaiKey(e.target.value);
                              setOpenaiValid(null);
                            }}
                            placeholder="sk-..."
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showOpenaiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidateKey('openai')}
                          disabled={!openaiKey || validatingOpenai}
                        >
                          {validatingOpenai ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            m['pages.settings.aiModel.validate']()
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveKey('openai')}
                          disabled={!openaiKey || openaiValid === false}
                        >
                          {m['pages.settings.aiModel.saveKey']()}
                        </Button>
                      </div>
                    )}
                    {openaiValid === true && (
                      <p className="flex items-center text-sm text-green-500">
                        <Check className="mr-1 h-4 w-4" /> {m['pages.settings.aiModel.keyValid']()}
                      </p>
                    )}
                    {openaiValid === false && (
                      <p className="flex items-center text-sm text-red-500">
                        <X className="mr-1 h-4 w-4" /> {m['pages.settings.aiModel.keyInvalid']()}
                      </p>
                    )}
                  </div>
                )}

                {/* Gemini Key */}
                {actualProvider === 'gemini' && (
                  <div className="space-y-2">
                    <Label>{m['pages.settings.aiModel.geminiKey']()}</Label>
                    {aiSettings?.hasGeminiKey ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-muted flex h-9 flex-1 items-center rounded-md px-3 text-sm">
                          <Check className="mr-2 h-4 w-4 text-green-500" />
                          {m['pages.settings.aiModel.keyStored']()}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearKey('gemini')}
                        >
                          {m['pages.settings.aiModel.clearKey']()}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showGeminiKey ? 'text' : 'password'}
                            value={geminiKey}
                            onChange={(e) => {
                              setGeminiKey(e.target.value);
                              setGeminiValid(null);
                            }}
                            placeholder="AIza..."
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showGeminiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidateKey('gemini')}
                          disabled={!geminiKey || validatingGemini}
                        >
                          {validatingGemini ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            m['pages.settings.aiModel.validate']()
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveKey('gemini')}
                          disabled={!geminiKey || geminiValid === false}
                        >
                          {m['pages.settings.aiModel.saveKey']()}
                        </Button>
                      </div>
                    )}
                    {geminiValid === true && (
                      <p className="flex items-center text-sm text-green-500">
                        <Check className="mr-1 h-4 w-4" /> {m['pages.settings.aiModel.keyValid']()}
                      </p>
                    )}
                    {geminiValid === false && (
                      <p className="flex items-center text-sm text-red-500">
                        <X className="mr-1 h-4 w-4" /> {m['pages.settings.aiModel.keyInvalid']()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Model Selection */}
            <div className="space-y-4">
              <h3 className="font-medium">{m['pages.settings.aiModel.modelPreferences']()}</h3>

              {/* Default Model (Composition) */}
              <FormField
                control={form.control}
                name="defaultModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m['pages.settings.aiModel.compositionModel']()}</FormLabel>
                    <FormDescription>
                      {m['pages.settings.aiModel.compositionModelDescription']()}
                    </FormDescription>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={m['pages.settings.aiModel.selectModel']()} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {compositionModels.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            <span>{model.label}</span>
                            {model.description && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                — {model.description}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Summarization Model */}
              <FormField
                control={form.control}
                name="summarizationModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m['pages.settings.aiModel.summarizationModel']()}</FormLabel>
                    <FormDescription>
                      {m['pages.settings.aiModel.summarizationModelDescription']()}
                    </FormDescription>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={m['pages.settings.aiModel.selectModel']()} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {summarizationModels.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            <span>{model.label}</span>
                            {model.description && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                — {model.description}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
