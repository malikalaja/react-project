<?php

namespace Database\Seeders;

use App\Models\Task;
use App\Models\TaskCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->seedUsers();

        $categoryIds = $this->seedTaskCategories();

        $this->seedTasks($categoryIds);
    }

    private function seedUsers(): void
    {
        User::firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        if (User::query()->count() === 1) {
            User::factory()->count(4)->create();
        }
    }

    /**
     * @return array<int, int>
     */
    private function seedTaskCategories(): array
    {
        $labels = ['Work', 'Personal', 'Shopping', 'Others'];

        foreach ($labels as $label) {
            TaskCategory::firstOrCreate(['name' => $label]);
        }

        return TaskCategory::query()->pluck('id')->all();
    }

    private function seedTasks(array $categoryIds): void
    {
        if (empty($categoryIds)) {
            return;
        }

        if (! Task::query()->exists()) {
            Task::factory()->count(100)->create();
        }

        Task::query()
            ->doesntHave('taskCategories')
            ->chunkById(50, function ($tasks) use ($categoryIds) {
                foreach ($tasks as $task) {
                    $selectionCount = min(random_int(1, 3), count($categoryIds));
                    $selection = Arr::wrap(Arr::random($categoryIds, $selectionCount));

                    $task->taskCategories()->syncWithoutDetaching($selection);
                }
            });
    }
}
