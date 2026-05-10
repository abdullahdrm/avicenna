from django.core.management.base import BaseCommand, CommandError

from avicenna_api.rag.importer import import_qa_file_to_db


class Command(BaseCommand):
    help = "Import Q&A text file, generate embeddings, and save to DB"

    def add_arguments(self, parser):
        parser.add_argument("file_path", type=str, help="Path to the txt file")
        parser.add_argument(
            "--delete-existing",
            action="store_true",
            help="Delete existing rows for this source file before import",
        )

    def handle(self, *args, **options):
        file_path = options["file_path"]
        delete_existing = options["delete_existing"]

        try:
            created_count = import_qa_file_to_db(
                file_path=file_path,
                delete_existing_for_file=delete_existing,
            )
        except FileNotFoundError:
            raise CommandError(f"File not found: {file_path}")
        except Exception as e:
            raise CommandError(str(e))

        self.stdout.write(
            self.style.SUCCESS(f"Imported {created_count} new Q&A embeddings.")
        )
