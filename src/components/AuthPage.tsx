import { useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setSuccess('注册成功！请查看邮箱确认链接，或直接登录。');
            }
        } catch (err: any) {
            setError(err.message || '操作失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">AI 知识合成器</h1>
                    <p className="text-stone-500 mt-2">你的私人 AI 知识库工作台</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-8">
                    <h2 className="text-xl font-bold text-stone-900 mb-6">
                        {isLogin ? '欢迎回来' : '创建账号'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">邮箱</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    required
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">密码</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="至少 6 位密码"
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-stone-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Success */}
                        {success && (
                            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">
                                {success}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                isLogin ? '登录' : '注册'
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <div className="mt-6 text-center text-sm text-stone-500">
                        {isLogin ? '还没有账号？' : '已有账号？'}
                        <button
                            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                            className="text-indigo-600 font-medium hover:text-indigo-700 ml-1"
                        >
                            {isLogin ? '立即注册' : '去登录'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-stone-400 mt-6">
                    数据安全存储于 Supabase 云端，支持跨设备同步
                </p>
            </div>
        </div>
    );
}
