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
import { Project } from "./project.entity.js";
import { Release } from "./release.entity.js";

/**
 * Where a project is deployed (`production`, `staging`, …), created by the
 * first upload with its name. Deleted with its project.
 */
@Entity({ name: "environment" })
@Unique("environment_project_name_unique", ["projectId", "name"])
export class Environment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id", type: "uuid" })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project?: Relation<Project>;

  @Column({ type: "text" })
  name: string;

  /**
   * The release that is deployed: the newest one uploaded, until a user
   * picks another. `null` only while the first upload is being stored.
   */
  @Column({ name: "live_release_id", type: "uuid", nullable: true })
  liveReleaseId: string | null;

  @ManyToOne(() => Release, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "live_release_id" })
  liveRelease?: Relation<Release> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
