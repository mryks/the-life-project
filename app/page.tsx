"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [input, setInput] = useState("");

  // 1. Load tasks from storage when the page opens
  useEffect(() => {
    const savedTasks = localStorage.getItem("thelife-tasks");
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      // Default tasks if it's the very first time
      setTasks([
        { id: 1, text: "Welcome to TheLifeProject!", completed: false },
        { id: 2, text: "Try checking off this task", completed: true },
      ]);
    }
  }, []);

  // 2. Save tasks to storage every time the list changes
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem("thelife-tasks", JSON.stringify(tasks));
    }
  }, [tasks]);

  // Function to add a new task
  const addTask = () => {
    if (!input.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: input, completed: false }]);
    setInput("");
  };

  // Function to check/uncheck a task
  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  // Function to delete a task
  const deleteTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      {/* Header & Input Area */}
      <div className="bg-white p-6 pb-8 shadow-sm rounded-b-3xl">
        <h1 className="text-3xl font-bold text-gray-800">Tasks ✅</h1>
        <p className="text-gray-500 mt-1">Get things done</p>
        
        <div className="mt-6 flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="What needs to be done?"
            className="flex-1 bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
          <button onClick={addTask} className="bg-blue-600 text-white px-5 rounded-xl font-bold hover:bg-blue-700 transition">Add</button>
        </div>
      </div>

      {/* Task List */}
      <div className="p-6 space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4">
            <button 
              onClick={() => toggleTask(task.id)}
              className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}
            >
              {task.completed && <span className="text-white text-xs font-bold">✓</span>}
            </button>
            <span className={`flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.text}</span>
            
            {/* Delete Button */}
            <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-500 transition">
              ✕
            </button>
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}