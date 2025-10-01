<?php

namespace Database\Seeders;

use App\Models\Task;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use App\Models\TaskCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $tasks = Task::factory()->count(100)->create();
        $taskCategories = ['Work', 'Personal', 'Shopping', 'Others'];
        foreach ($taskCategories as $task) {
            TaskCategory::firstOrCreate(
                ['name' => $task]
            );
        }

        foreach ($tasks as $task) {
            $task->taskCategories()->attach(TaskCategory::inRandomOrder()->first()->id);
        }
    }
}
