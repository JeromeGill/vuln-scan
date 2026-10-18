import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from "typeorm";
import { Environment } from "./environment.entity.js";

/**
 * One version deployed to an environment: the uploads with the same
 * environment and version. The version is an opaque string, never ordered.
 * Deleted with its environment.
 */
@Entity({ name: "release" })
@Unique("release_environment_version_unique", ["environmentId", "version"])
export class Release {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "environment_id", type: "uuid" })
  environmentId: string;

  @ManyToOne(() => Environment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "environment_id" })
  environment?: Relation<Environment>;

  @Column({ type: "text" })
  version: string;

  /** When its first file was uploaded. */
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
