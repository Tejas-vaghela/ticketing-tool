import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { SprintsModule } from './sprints/sprints.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivityModule } from './activity/activity.module';
import { IssuesModule } from './issues/issues.module';
import { SavedFiltersModule } from './saved-filters/saved-filters.module';
import { EpicsModule } from './epics/epics.module';
import { KanbanModule } from './kanban/kanban.module';
import { SearchModule } from './search/search.module';
import { SystemModule } from './system/system.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    AttachmentsModule,
    SprintsModule,
    NotificationsModule,
    ActivityModule,
    IssuesModule,
    SavedFiltersModule,
    EpicsModule,
    KanbanModule,
    SearchModule,
    SystemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
