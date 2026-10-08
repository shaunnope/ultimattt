# Seed Parsing Refinements
Guidelines:
1. Starting a game from a generated seed of a prior game should produce the same computer move sequence, if the player moves identically
2. Parsing of a seed should never fail. If an entered seed does not match seed format guidelines, a valid seed should be generated instead, using the entered value as an IV.
3. seed formatting (dashes, capitalization) should be optional