import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAskVerity, ChatMessage, AskSource } from '../hooks/useAskVerity';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { hapticLight } from '../lib/haptics';
import { track } from '../lib/analytics';

const SUGGESTED_QUESTIONS = [
  "Who are the biggest political donors in Australia?",
  "What bills are currently before Parliament?",
  "How did my MP vote on climate legislation?",
  "What government contracts were awarded to consulting firms?",
  "What are the registered interests of senators?",
];

function SourceBadge({ source }: { source: AskSource }) {
  const { colors } = useTheme();
  const typeLabel: Record<string, string> = {
    bill: 'Bill',
    hansard: 'Speech',
    donation: 'Donation',
    contract: 'Contract',
    interest: 'Interest',
    policy: 'Policy',
    member: 'MP',
    division: 'Vote',
  };

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.sm,
    }}>
      <Ionicons name="document-text-outline" size={11} color={colors.textMuted} />
      <Text style={{ fontSize: 11, color: colors.textMuted }}>
        {typeLabel[source.type] ?? source.type}
      </Text>
    </View>
  );
}

function MessageBubble({ message, colors }: { message: ChatMessage; colors: any }) {
  const isUser = message.role === 'user';

  return (
    <View style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
      marginBottom: SPACING.md,
    }}>
      <View style={{
        backgroundColor: isUser ? '#00843D' : colors.card,
        borderRadius: BORDER_RADIUS.lg,
        borderTopRightRadius: isUser ? 4 : BORDER_RADIUS.lg,
        borderTopLeftRadius: isUser ? BORDER_RADIUS.lg : 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        ...(!isUser ? SHADOWS.sm : {}),
      }}>
        <Text style={{
          fontSize: FONT_SIZE.body,
          lineHeight: 22,
          color: isUser ? '#ffffff' : colors.text,
        }}>
          {message.content}
        </Text>
      </View>

      {/* Source citations */}
      {message.sources && message.sources.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, paddingLeft: 4 }}>
          {message.sources.slice(0, 5).map((source, i) => (
            <SourceBadge key={i} source={source} />
          ))}
          {message.sources.length > 5 && (
            <Text style={{ fontSize: 11, color: colors.textMuted, alignSelf: 'center' }}>
              +{message.sources.length - 5} more
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export function AskScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { messages, loading, ask, clearChat } = useAskVerity();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    hapticLight();
    track('ask_verity', { question_length: input.trim().length });
    ask(input.trim());
    setInput('');
    Keyboard.dismiss();
  };

  const handleSuggestion = (question: string) => {
    hapticLight();
    track('ask_verity_suggestion', { question });
    ask(question);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 0.5, borderBottomColor: colors.border,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: '#00843D', justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </View>
          <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
            Ask Verity
          </Text>
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={clearChat} hitSlop={12} accessibilityLabel="Clear chat" accessibilityRole="button">
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            /* Empty state with suggestions */
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center',
                marginBottom: SPACING.lg,
              }}>
                <Ionicons name="sparkles" size={28} color="#00843D" />
              </View>
              <Text style={{
                fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
                color: colors.text, textAlign: 'center', marginBottom: SPACING.sm,
              }}>
                Ask anything about Australian politics
              </Text>
              <Text style={{
                fontSize: FONT_SIZE.body, color: colors.textMuted,
                textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl,
                paddingHorizontal: 20,
              }}>
                Powered by real parliamentary data — bills, votes, donations, contracts, and speeches.
              </Text>

              <View style={{ width: '100%', gap: SPACING.sm }}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleSuggestion(q)}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      padding: 14, backgroundColor: colors.card,
                      borderRadius: BORDER_RADIUS.md,
                      opacity: pressed ? 0.8 : 1,
                      ...SHADOWS.sm,
                    })}
                    accessibilityLabel={`Ask: ${q}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="#00843D" />
                    <Text style={{ flex: 1, fontSize: FONT_SIZE.body, color: colors.text }}>
                      {q}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            /* Chat messages */
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} colors={colors} />
              ))}
              {loading && (
                <View style={{ alignSelf: 'flex-start', paddingVertical: SPACING.md }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 14, paddingVertical: 10,
                    backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
                    borderTopLeftRadius: 4,
                  }}>
                    <ActivityIndicator size="small" color="#00843D" />
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                      Searching parliamentary data...
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
          paddingHorizontal: 16, paddingVertical: 12,
          borderTopWidth: 0.5, borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about Australian politics..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            style={{
              flex: 1, fontSize: FONT_SIZE.body, color: colors.text,
              backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.lg,
              paddingHorizontal: 16, paddingVertical: 12,
              maxHeight: 100, minHeight: 44,
            }}
            accessibilityLabel="Type your question"
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || loading}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: input.trim() && !loading ? '#00843D' : colors.surface,
              justifyContent: 'center', alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
            accessibilityLabel="Send question"
            accessibilityRole="button"
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() && !loading ? '#ffffff' : colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
