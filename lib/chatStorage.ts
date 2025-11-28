import { supabase } from './supabase';
import { ChatSession, Message } from '@/app/types';

const DEVICE_ID_KEY = 'chat-device-id';
const STORAGE_KEY = 'chat-sessions';

/**
 * 디바이스 고유 ID를 생성하거나 조회합니다.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * 모든 채팅 세션을 조회합니다.
 */
export async function getSessions(): Promise<ChatSession[]> {
  const deviceId = getDeviceId();

  try {
    // 세션 목록 조회
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    // 각 세션의 메시지 조회
    const sessionIds = sessions.map((s) => s.id);
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return [];
    }

    // 세션과 메시지를 결합
    const sessionsWithMessages: ChatSession[] = sessions.map((session) => {
      const sessionMessages: Message[] = (messages || [])
        .filter((msg) => msg.session_id === session.id)
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

      return {
        id: session.id,
        title: session.title,
        messages: sessionMessages,
        createdAt: session.created_at,
      };
    });

    return sessionsWithMessages;
  } catch (error) {
    console.error('Error in getSessions:', error);
    return [];
  }
}

/**
 * 새 채팅 세션을 생성합니다.
 */
export async function createSession(
  sessionId: string,
  title: string,
  messages: Message[]
): Promise<ChatSession | null> {
  const deviceId = getDeviceId();

  try {
    // 세션 생성
    const { error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({
        id: sessionId,
        device_id: deviceId,
        title,
        created_at: new Date().toISOString(),
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return null;
    }

    // 메시지 삽입
    if (messages.length > 0) {
      const messagesToInsert = messages.map((msg) => ({
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        created_at: new Date().toISOString(),
      }));

      const { error: messagesError } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      if (messagesError) {
        console.error('Error inserting messages:', messagesError);
        // 세션은 생성되었지만 메시지 삽입 실패 시 세션 삭제
        await supabase.from('chat_sessions').delete().eq('id', sessionId);
        return null;
      }
    }

    return {
      id: sessionId,
      title,
      messages,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in createSession:', error);
    return null;
  }
}

/**
 * 세션의 메시지를 업데이트합니다.
 */
export async function updateSessionMessages(
  sessionId: string,
  messages: Message[]
): Promise<boolean> {
  const deviceId = getDeviceId();

  try {
    // 세션이 존재하고 현재 디바이스의 것인지 확인
    const { data: session, error: checkError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('device_id', deviceId)
      .single();

    if (checkError || !session) {
      console.error('Session not found or access denied:', checkError);
      return false;
    }

    // 기존 메시지 삭제
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      console.error('Error deleting old messages:', deleteError);
      return false;
    }

    // 새 메시지 삽입
    if (messages.length > 0) {
      const messagesToInsert = messages.map((msg) => ({
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        created_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      if (insertError) {
        console.error('Error inserting messages:', insertError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error in updateSessionMessages:', error);
    return false;
  }
}

/**
 * 세션을 삭제합니다.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const deviceId = getDeviceId();

  try {
    // 세션이 존재하고 현재 디바이스의 것인지 확인
    const { data: session, error: checkError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('device_id', deviceId)
      .single();

    if (checkError || !session) {
      console.error('Session not found or access denied:', checkError);
      return false;
    }

    // 세션 삭제 (CASCADE로 메시지도 자동 삭제됨)
    const { error: deleteError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) {
      console.error('Error deleting session:', deleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteSession:', error);
    return false;
  }
}

/**
 * localStorage의 데이터를 Supabase로 마이그레이션합니다.
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const deviceId = getDeviceId();
  const savedSessions = localStorage.getItem(STORAGE_KEY);

  if (!savedSessions) {
    return false; // 마이그레이션할 데이터가 없음
  }

  try {
    const parsedSessions = JSON.parse(savedSessions) as ChatSession[];

    if (!Array.isArray(parsedSessions) || parsedSessions.length === 0) {
      return false;
    }

    // DB에 이미 데이터가 있는지 확인
    const { data: existingSessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('device_id', deviceId)
      .limit(1);

    // 이미 데이터가 있으면 마이그레이션하지 않음 (중복 방지)
    if (existingSessions && existingSessions.length > 0) {
      console.log('Data already exists in DB, skipping migration');
      return false;
    }

    // 모든 세션을 DB에 저장
    for (const session of parsedSessions) {
      const success = await createSession(
        session.id,
        session.title,
        session.messages
      );

      if (!success) {
        console.error(`Failed to migrate session: ${session.id}`);
        return false;
      }
    }

    // 마이그레이션 성공 시 localStorage 데이터 삭제
    localStorage.removeItem(STORAGE_KEY);
    console.log(`Successfully migrated ${parsedSessions.length} sessions to DB`);

    return true;
  } catch (error) {
    console.error('Error migrating from localStorage:', error);
    return false;
  }
}

