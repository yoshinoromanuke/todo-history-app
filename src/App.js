import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // セッションの確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="container">読み込み中...</div>;
  }

  return (
    <div className="container">
      <h1>Todo履歴管理アプリ</h1>
      {!session ? <Auth /> : <TodoList session={session} />}
    </div>
  );
}

// 認証コンポーネント
function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('登録確認メールを送信しました。メールをご確認ください。');
    }
    setLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form>
        <h2>ログイン/新規登録</h2>
        {message && <div className="message">{message}</div>}
        <div className="form-group">
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="button-group">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="button"
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="button"
          >
            新規登録
          </button>
        </div>
      </form>
    </div>
  );
}

// Todoリストコンポーネント
function TodoList({ session }) {
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // タスク一覧の取得
  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching tasks:', error);
    else setTasks(data || []);
    setLoading(false);
  };

  // タスク履歴の取得
  const fetchTaskHistory = async (taskId = null) => {
    let query = supabase.from('task_history').select(`
      id, 
      status, 
      changed_at, 
      task_id,
      tasks(title)
    `).order('changed_at', { ascending: false });
    
    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { data, error } = await query;

    if (error) console.error('Error fetching history:', error);
    else setHistory(data || []);
  };

  // 初期データの読み込み
  useEffect(() => {
    fetchTasks();
  }, []);

  // タスクの追加
  const addTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const { error } = await supabase.from('tasks').insert([
      {
        title: taskTitle,
        description: taskDescription,
        user_id: session.user.id
      }
    ]);

    if (error) {
      console.error('Error adding task:', error);
    } else {
      setTaskTitle('');
      setTaskDescription('');
      fetchTasks();
    }
  };

  // タスク完了状態の切り替え
  const toggleTaskCompletion = async (id, is_completed) => {
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !is_completed, updated_at: new Date() })
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error);
    } else {
      fetchTasks();
    }
  };

  // タスクの削除
  const deleteTask = async (id) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
    } else {
      fetchTasks();
    }
  };

  // ログアウト
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // 履歴を表示
  const handleShowHistory = async (taskId = null) => {
    await fetchTaskHistory(taskId);
    setShowHistory(true);
  };

  return (
    <div className="todo-container">
      <div className="header">
        <h2>TODOリスト</h2>
        <button onClick={handleLogout} className="logout-button">ログアウト</button>
      </div>

      <form onSubmit={addTask} className="task-form">
        <div className="form-group">
          <input
            type="text"
            placeholder="タスクを入力"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <textarea
            placeholder="説明（任意）"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
          />
        </div>
        <button type="submit" className="add-button">追加</button>
      </form>

      <div className="tasks-header">
        <h3>タスク一覧</h3>
        <button onClick={() => handleShowHistory()} className="history-button">すべての履歴を表示</button>
      </div>

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={`task-item ${task.is_completed ? 'completed' : ''}`}>
              <div className="task-content">
                <h4>{task.title}</h4>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  <small>作成日: {new Date(task.created_at).toLocaleString()}</small>
                </div>
              </div>
              <div className="task-actions">
                <button onClick={() => handleShowHistory(task.id)} className="history-button small">履歴</button>
                <button onClick={() => toggleTaskCompletion(task.id, task.is_completed)} className="toggle-button">
                  {task.is_completed ? '未完了に戻す' : '完了にする'}
                </button>
                <button onClick={() => deleteTask(task.id)} className="delete-button">削除</button>
              </div>
            </li>
          ))}
          {tasks.length === 0 && <p>タスクはありません</p>}
        </ul>
      )}

      {showHistory && (
        <div className="history-modal">
          <div className="history-content">
            <div className="history-header">
              <h3>タスク履歴</h3>
              <button onClick={() => setShowHistory(false)} className="close-button">閉じる</button>
            </div>
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.id} className="history-item">
                  <div className="history-task-title">{item.tasks?.title || '削除されたタスク'}</div>
                  <div className={`history-status ${item.status}`}>{item.status}</div>
                  <div className="history-date">{new Date(item.changed_at).toLocaleString()}</div>
                </li>
              ))}
              {history.length === 0 && <p>履歴はありません</p>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;