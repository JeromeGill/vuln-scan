import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

/** Better Auth verification (`verification` model), e.g. email verification tokens. */
@Entity({ schema: "auth", name: "verification" })
export class BaVerification {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Index()
  @Column({ type: "text" })
  identifier: string;

  @Column({ type: "text" })
  value: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
