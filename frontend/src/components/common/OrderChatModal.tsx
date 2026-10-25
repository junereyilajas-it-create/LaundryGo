import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Loader2, MessageSquare, User, Truck, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface OrderMessage {
  id: number;
  order_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface OrderChatModalProps {
  orderId: number;
  orderNumber: string;
  onClose: () => void;
}

export default function OrderChatModal({ orderId, orderNumber, onClose }: OrderChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const { data } = await api.get(`/messages/${orderId}`);
      setMessages(data);
    } catch (err) {
      console.error('Error fetching order messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Real-time polling every 4 seconds while chat modal is open
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const { data } = await api.post(`/messages/${orderId}`, { message: messageText });
      setMessages((prev) => [...prev, data]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send message');
      setInputText(messageText); // restore on error
    } finally {
      setSending(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'driver') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    if (role === 'worker' || role === 'admin') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col h-[550px] overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                Order Chat • {orderNumber}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Customer, Driver & Support Channel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-gray-50/50 dark:bg-gray-950/50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
              <MessageSquare className="w-10 h-10 mb-2 stroke-1 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No messages yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Use this chat to coordinate pickup notes, gate codes, or delivery questions.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {isMe ? 'You' : msg.sender_name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase ${getRoleBadge(msg.sender_role)}`}>
                      {msg.sender_role}
                    </span>
                    <span>• {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex gap-2">
          <input
            type="text"
            placeholder="Type your message or delivery note..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 shadow-sm"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
