export interface Task {
  id: string;
  goal: string;
  subtasks: Task[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export class Planner {
  private tasks = new Map<string, Task>();

  decompose(goal: string): Task {
    const taskId = `task-${Date.now()}`;
    const task: Task = {
      id: taskId,
      goal,
      subtasks: [],
      status: 'pending',
    };
    this.tasks.set(taskId, task);
    console.log(`[Planner] Decomposed goal: ${goal} -> ${taskId}`);
    return task;
  }

  updateTaskStatus(taskId: string, status: Task['status']): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      console.log(`[Planner] Task ${taskId} -> ${status}`);
    }
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  // Coordinates goal decomposition and task scheduling
}