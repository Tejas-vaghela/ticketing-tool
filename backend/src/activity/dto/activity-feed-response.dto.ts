import { ActivityEventResponseDto } from './activity-event-response.dto';

export class ActivityFeedResponseDto {
  items!: ActivityEventResponseDto[];
  nextCursor?: string | null;
  hasMore!: boolean;
  total!: number;
}
