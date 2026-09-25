# DynamoDB table for the score leaderboard.
#
# A score is stored as a single item. The two scope attributes let the six
# GSIs serve the two query shapes (all scores vs. one board size) across the
# three sort dimensions. A single PutItem is atomic by construction, so no
# transaction is needed.
#
# `#` is a safe separator in the sort-key encodings: player names are
# allow-listed to [A-Za-z0-9 _\-.], createdAt is ISO 8601, and id is a UUID,
# so none of them can contain it.
resource "aws_dynamodb_table" "scores" {
  name                        = "${var.project_name}-${var.environment}-scores"
  billing_mode                = "PAY_PER_REQUEST"
  deletion_protection_enabled = true

  # The table level uses hash_key; global_secondary_index uses key_schema blocks.
  # The provider deprecates the single-argument form only inside the index block.
  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "allScope"
    type = "S"
  }

  attribute {
    name = "boardScope"
    type = "S"
  }

  attribute {
    name = "pointsKey"
    type = "S"
  }

  attribute {
    name = "timeKey"
    type = "S"
  }

  attribute {
    name = "playerKey"
    type = "S"
  }

  global_secondary_index {
    name = "by-points-all"

    key_schema {
      attribute_name = "allScope"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "pointsKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "by-time-all"

    key_schema {
      attribute_name = "allScope"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "timeKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "by-player-all"

    key_schema {
      attribute_name = "allScope"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "playerKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "by-points-board"

    key_schema {
      attribute_name = "boardScope"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "pointsKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "by-time-board"

    key_schema {
      attribute_name = "boardScope"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "timeKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "by-player-board"

    key_schema {
      attribute_name = "boardScope"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "playerKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }
}
