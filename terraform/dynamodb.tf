# DynamoDB table for the score leaderboard.
#
# The table primary key is id (partition) + scopeKey (sort). A score is written
# twice: once with scopeKey = "all" for unfiltered leaderboard queries, and once
# with scopeKey = "board#<boardSize>" for board-size-filtered queries. Both
# copies share the same GSI sort keys, so each of the three GSIs serves both
# access patterns without a table scan.
#
# `#` is a safe separator in the sort-key encodings: player names are
# allow-listed to [A-Za-z0-9 _\-.], createdAt is ISO 8601, and id is a UUID,
# so none of them can contain it.
resource "aws_dynamodb_table" "scores" {
  name                        = "${var.project_name}-${var.environment}-scores"
  billing_mode                = "PAY_PER_REQUEST"
  deletion_protection_enabled = true

  # The table keys stay as hash_key/range_key: the provider schema exposes no
  # key_schema block at this level, and neither argument is deprecated here.
  hash_key  = "id"
  range_key = "scopeKey"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "scopeKey"
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
    name = "by-points"

    key_schema {
      attribute_name = "scopeKey"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "pointsKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "by-time"

    key_schema {
      attribute_name = "scopeKey"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "timeKey"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "by-player"

    key_schema {
      attribute_name = "scopeKey"
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
